import type { AgentRunIdentity } from "../contracts.ts";
import { AgenticError } from "../errors.ts";
import { assertRunIdentity } from "./identity.ts";

export type ToolCapability = "read" | "analyze" | "prepare" | "write" | "external";

/** Actor ID and agent ID come from an authenticated server session, never model output. */
export function assertToolAccess(options: {
  identity: AgentRunIdentity;
  capability: ToolCapability;
  permittedAgents: readonly string[];
  publicDemo?: boolean;
}): void {
  assertRunIdentity(options.identity);
  if (!options.permittedAgents.includes(options.identity.agentId)) {
    throw new AgenticError("AGENT_TOOL_FORBIDDEN", 403);
  }
  if (options.capability === "external") {
    // No outbound actions (email, submission, payments) in stage 04.
    throw new AgenticError("AGENT_TOOL_FORBIDDEN", 403);
  }
  if (options.identity.access.kind === "public_demo" &&
      (options.capability !== "read" || !options.publicDemo || options.identity.agentId !== "demo")) {
    throw new AgenticError("AGENT_TOOL_FORBIDDEN", 403);
  }
}
