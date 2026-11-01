import type { AgentRunIdentity } from "../../../core/contracts.ts";
import { AgenticError } from "../../../core/errors.ts";
import { AgentToolRegistry } from "../../../core/tools/agent-tool-registry.ts";

/** In-memory fake writer for the mandatory LangGraph HITL integration test only. */
export function createReviewDemoRegistry(options: {
  identity: AgentRunIdentity;
  getRevision: () => string;
  record: (idempotencyKey: string) => void;
}) {
  const registry = new AgentToolRegistry();
  registry.register({
    name: "demo_update",
    capability: "write",
    permittedAgents: ["demo"],
    parse(raw) {
      if (!raw || typeof raw !== "object") throw Error("invalid");
      const value = raw as Record<string, unknown>;
      if (value.resourceId !== "demo-resource" || value.revision !== "v1") throw Error("invalid");
      return { resourceId: "demo-resource", revision: "v1" };
    },
    authorize(input, context) {
      if (context.identity.access.kind !== "authenticated" ||
          options.identity.access.kind !== "authenticated" ||
          context.identity.access.actorId !== options.identity.access.actorId ||
          input.revision !== options.getRevision()) {
        throw new AgenticError("AGENT_TOOL_FORBIDDEN", 403);
      }
    },
    target(input) { return input; },
    executeIdempotently(_input, _context, key) {
      options.record(key);
      return "approved";
    },
  });
  return registry;
}
