import type { JobMatchAgentState } from "../agent/state";
import { verifyEvidenceMatch } from "../tools/verify.tool";

export function verifyJobMatchNode(state: typeof JobMatchAgentState.State) {
  if (!state.match || !state.analysis) throw new Error("JOB_MATCH_RESULT_REQUIRED");
  verifyEvidenceMatch(state.input, state.analysis, state.match);
  return { verified: true };
}
