import type { JobMatchAgentState } from "../agent/state";
import { compareCandidateToJob } from "../tools/compare.tool";

export function compareJobMatchNode(state: typeof JobMatchAgentState.State) {
  if (!state.analysis) throw new Error("JOB_MATCH_ANALYSIS_REQUIRED");
  return { match: compareCandidateToJob(state.input, state.analysis) };
}
