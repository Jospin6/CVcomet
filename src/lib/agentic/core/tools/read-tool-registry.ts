import type { AgentAccess } from "../contracts.ts";
import { AgenticError } from "../errors.ts";

export type ReadToolContext = Readonly<{ access: AgentAccess; signal: AbortSignal }>;

/** Every tool must independently authorize access; the LLM is never an actor. */
export type ReadToolDefinition<TInput, TOutput> = Readonly<{
  name: string;
  validate: (raw: unknown) => TInput;
  authorize: (input: TInput, context: ReadToolContext) => void | Promise<void>;
  execute: (input: TInput, context: ReadToolContext) => TOutput | Promise<TOutput>;
  publicDemo?: boolean;
}>;

/** Stage 02 intentionally supports READ-ONLY operations, not mutating tools. */
export class ReadToolRegistry {
  private readonly tools = new Map<string, (raw: unknown, context: ReadToolContext) => Promise<unknown>>();

  register<TInput, TOutput>(definition: ReadToolDefinition<TInput, TOutput>): void {
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(definition.name) || this.tools.has(definition.name)) {
      throw new AgenticError("AGENT_TOOL_DUPLICATE", 400);
    }
    this.tools.set(definition.name, async (raw, context) => {
      if (context.signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
      if (context.access.kind === "public_demo" && !definition.publicDemo) {
        throw new AgenticError("AGENT_TOOL_FORBIDDEN", 403);
      }
      let input: TInput;
      try { input = definition.validate(raw); } catch {
        throw new AgenticError("AGENT_TOOL_INPUT_INVALID", 400);
      }
      // Authorization errors must not expose raw DB details to callers.
      // Each domain tool must verify ownership in the DB at execution time.
      try {
        await definition.authorize(input, context);
      } catch {
        if (context.signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
        throw new AgenticError("AGENT_TOOL_FORBIDDEN", 403);
      }
      if (context.signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
      try {
        const result = await definition.execute(input, context);
        if (context.signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
        return result;
      } catch (error) {
        if (context.signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
        if (error instanceof AgenticError) throw error;
        throw new AgenticError("AGENT_STEP_FAILED");
      }
    });
  }

  async invoke(name: string, raw: unknown, context: ReadToolContext): Promise<unknown> {
    const invoke = this.tools.get(name);
    if (!invoke) throw new AgenticError("AGENT_TOOL_UNKNOWN", 404);
    return invoke(raw, context);
  }
}
