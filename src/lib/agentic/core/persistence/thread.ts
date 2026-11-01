import { createHash } from "node:crypto";
import type { AgentRunIdentity } from "../contracts.ts";
import { AgenticError } from "../errors.ts";
import { assertRunIdentity } from "../policies/identity.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A mission ID is created by trusted application code, not by the LLM. */
export type DurableMission = Readonly<{
  identity: AgentRunIdentity;
  missionId: string;
}>;

/** Internal config only. Never send the thread ID to the browser or model. */
export type ThreadConfig = Readonly<{
  configurable: Readonly<{ thread_id: string }>;
}>;

/**
 * Stable, tenant-separated, opaque thread IDs (71 chars, below PostgreSQL limits).
 * Do not use runId: a run attempt changes when an interrupted mission is resumed.
 */
export function makeMissionThread(mission: DurableMission): ThreadConfig {
  assertRunIdentity(mission.identity);
  if (mission.identity.access.kind !== "authenticated") {
    throw new AgenticError("AGENT_ACCESS_DENIED", 403);
  }
  if (!UUID.test(mission.missionId)) {
    throw new AgenticError("AGENT_INVALID_MISSION_ID", 400);
  }
  const parts = ["cvcomet-agentic-v1", mission.identity.access.actorId,
    mission.identity.agentId, mission.missionId.toLowerCase()];
  const digest = createHash("sha256")
    .update(parts.map((part) => `${part.length}:${part}`).join("|"))
    .digest("hex");
  return { configurable: { thread_id: `cv3-v1-${digest}` } };
}
