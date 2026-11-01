import type { AgentRunIdentity } from "../contracts.ts";
import { AgenticError } from "../errors.ts";
import {
  assertVerifiedApproval, makeApprovalRequest,
  type ApprovalRequest, type ResourceRevision, type VerifiedApproval,
} from "../policies/approval.ts";
import { assertToolAccess, type ToolCapability } from "../policies/tool-access.ts";
import { assertRunIdentity } from "../policies/identity.ts";

const TOOL_NAME = /^[a-z][a-z0-9_]{1,63}$/;

export type AgentToolContext = Readonly<{
  identity: AgentRunIdentity;
  signal: AbortSignal;
  /** Trusted server-generated UUID, never accepted from model tool arguments. */
  missionId?: string;
  /** Minted only after a matching human approval has resumed the graph. */
  approval?: VerifiedApproval;
}>;

type CommonTool<TInput> = Readonly<{
  name: string;
  permittedAgents: readonly string[];
  parse: (raw: unknown) => TInput;
  /** Must check ownership/access using the DB at call time. */
  authorize: (input: TInput, context: AgentToolContext) => void | Promise<void>;
  publicDemo?: boolean;
}>;

type OrdinaryTool<TInput, TOutput> = CommonTool<TInput> & Readonly<{
  capability: Exclude<ToolCapability, "write">;
  execute: (input: TInput, context: AgentToolContext) => TOutput | Promise<TOutput>;
}>;

type WriteTool<TInput, TOutput> = CommonTool<TInput> & Readonly<{
  capability: "write";
  /** Must extract the exact persisted resource and optimistic revision. */
  target: (input: TInput) => ResourceRevision;
  /** Must atomically dedupe idempotencyKey AND check the current revision in the DB. */
  executeIdempotently: (input: TInput, context: AgentToolContext, idempotencyKey: string) =>
    TOutput | Promise<TOutput>;
}>;

export type AgentToolDefinition<TInput, TOutput> = OrdinaryTool<TInput, TOutput> | WriteTool<TInput, TOutput>;

type RegisteredTool = Readonly<{
  capability: ToolCapability;
  permittedAgents: readonly string[];
  publicDemo: boolean;
  invoke: (raw: unknown, context: AgentToolContext) => Promise<unknown>;
  prepareApproval: (raw: unknown, context: AgentToolContext) => Promise<ApprovalRequest>;
}>;

/**
 * A strict policy gateway, not a direct model executor.
 * - no implicit privileges, wildcard agents, or external actions
 * - all tools authorize at execution (and again after HITL resume)
 * - writes require a verified, operation-bound approval plus durable idempotency
 */
export class AgentToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  register<TInput, TOutput>(definition: AgentToolDefinition<TInput, TOutput>): void {
    if (!TOOL_NAME.test(definition.name) || this.tools.has(definition.name) ||
        !definition.permittedAgents.length ||
        definition.permittedAgents.some((id) => !/^[a-z][a-z0-9-]{1,63}$/.test(id)) ||
        (definition.capability === "write" && typeof definition.executeIdempotently !== "function")) {
      throw new AgenticError("AGENT_TOOL_DUPLICATE", 400);
    }

    const authorize = async (input: TInput, context: AgentToolContext) => {
      if (context.signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
      assertToolAccess({ identity: context.identity, capability: definition.capability,
        permittedAgents: definition.permittedAgents, publicDemo: definition.publicDemo });
      try {
        await definition.authorize(input, context);
      } catch {
        if (context.signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
        throw new AgenticError("AGENT_TOOL_FORBIDDEN", 403);
      }
      if (context.signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
    };

    const parse = (raw: unknown): TInput => {
      try { return definition.parse(raw); }
      catch { throw new AgenticError("AGENT_TOOL_INPUT_INVALID", 400); }
    };

    const buildApproval = (input: TInput, context: AgentToolContext): ApprovalRequest => {
      if (definition.capability !== "write" || !context.missionId) {
        throw new AgenticError("AGENT_APPROVAL_REQUIRED", 403);
      }
      let target: ResourceRevision;
      try { target = definition.target(input); }
      catch { throw new AgenticError("AGENT_APPROVAL_INVALID", 400); }
      return makeApprovalRequest({ identity: context.identity, missionId: context.missionId,
        toolName: definition.name, target, input });
    };

    this.tools.set(definition.name, {
      capability: definition.capability,
      permittedAgents: definition.permittedAgents,
      publicDemo: Boolean(definition.publicDemo),
      prepareApproval: async (raw, context) => {
        if (definition.capability !== "write") throw new AgenticError("AGENT_APPROVAL_INVALID", 400);
        const input = parse(raw);
        await authorize(input, context);
        return buildApproval(input, context);
      },
      invoke: async (raw, context) => {
        const input = parse(raw);
        await authorize(input, context);
        if (definition.capability === "write") {
          const request = buildApproval(input, context);
          const receipt = assertVerifiedApproval({ request, receipt: context.approval });
          try {
            // This service contract MUST be implemented with DB-level idempotency by the
            // future domain tool. The gateway cannot guarantee transactionality by itself.
            const result = await definition.executeIdempotently(input, context, receipt.idempotencyKey);
            if (context.signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
            return result;
          } catch (error) {
            if (context.signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
            if (error instanceof AgenticError) throw error;
            throw new AgenticError("AGENT_STEP_FAILED");
          }
        }
        try {
          const result = await definition.execute(input, context);
          if (context.signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
          return result;
        } catch (error) {
          if (context.signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
          if (error instanceof AgenticError) throw error;
          throw new AgenticError("AGENT_STEP_FAILED");
        }
      },
    });
  }

  async prepareApproval(name: string, input: unknown, context: AgentToolContext): Promise<ApprovalRequest> {
    const definition = this.tools.get(name);
    if (!definition) throw new AgenticError("AGENT_TOOL_UNKNOWN", 404);
    return definition.prepareApproval(input, context);
  }

  async invoke(name: string, input: unknown, context: AgentToolContext): Promise<unknown> {
    const definition = this.tools.get(name);
    if (!definition) throw new AgenticError("AGENT_TOOL_UNKNOWN", 404);
    return definition.invoke(input, context);
  }

  listForAgent(identity: AgentRunIdentity): string[] {
    assertRunIdentity(identity);
    // Tool names may be surfaced to a planner, but access must still be rechecked
    // for every invocation. Never use this list for authorization.
    return [...this.tools.keys()].filter((name) => {
      const definition = this.tools.get(name);
      return Boolean(definition && definition.capability !== "external" &&
        definition.permittedAgents.includes(identity.agentId) &&
        (identity.access.kind === "authenticated" ||
          (identity.agentId === "demo" && definition.capability === "read" && definition.publicDemo)));
    });
  }
}
