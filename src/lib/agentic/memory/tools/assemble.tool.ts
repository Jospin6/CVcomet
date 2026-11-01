import type { MemoryAgent } from "../tools/policy.tool";
import { selectAgentPreferences } from "../tools/policy.tool";

export type StoredPreference = {
  key: string; value: string; allowedAgents: string[];
};
export type MissionProgress = {
  id: string; title: string; revision: number; status: "ACTIVE" | "ARCHIVED";
  completedRuns: number; pendingApprovals: number;
};
export type AgentMemorySnapshot = Readonly<{
  preferences: { key: string; value: string }[];
  mission?: MissionProgress;
}>;

/** No LLM, vectors or cross-user joins: filter exact opt-in scope and owner first. */
export function assembleAgentMemory(
  entries: readonly StoredPreference[], agentId: MemoryAgent, mission?: MissionProgress,
): AgentMemorySnapshot {
  return { preferences: selectAgentPreferences(entries, agentId), ...(mission ? { mission } : {}) };
}

