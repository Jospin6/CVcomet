import type { JobMatchAgentState } from "../agent/state";

export function assembleJobMatchNode(state: typeof JobMatchAgentState.State) {
  if (!state.verified || !state.analysis || !state.match || !state.resumePlan) throw new Error("JOB_MATCH_NOT_READY");
  return { result: { analysis: state.analysis, match: { ...state.match, resumePlan: state.resumePlan } } };
}
