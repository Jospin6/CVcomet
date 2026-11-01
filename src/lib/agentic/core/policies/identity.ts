import type { AgentRunIdentity } from "../contracts.ts";
import { AgenticError } from "../errors.ts";

const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;

/** identity must be constructed server-side, never copied from model tool input. */
export function assertRunIdentity(identity: AgentRunIdentity): void {
  if (!identity || !SAFE_ID.test(identity.runId) || !SAFE_ID.test(identity.agentId) ||
      !identity.access || typeof identity.access !== "object") {
    throw new AgenticError("AGENT_INVALID_IDENTITY", 400);
  }
  if (identity.access.kind === "authenticated") {
    if (typeof identity.access.actorId !== "string" ||
        !SAFE_ID.test(identity.access.actorId)) {
      throw new AgenticError("AGENT_INVALID_IDENTITY", 401);
    }
  } else if (identity.access.kind !== "public_demo" || identity.agentId !== "demo") {
    throw new AgenticError("AGENT_ACCESS_DENIED", 403);
  }
}
