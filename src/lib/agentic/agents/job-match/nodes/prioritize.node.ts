import type { JobMatchAgentState } from "../agent/state";
import { prepareResumeActions } from "../tools/resume-actions.tool";

export function prioritizeJobMatchNode(state: typeof JobMatchAgentState.State) {
  if (!state.verified || !state.match) throw new Error("JOB_MATCH_NOT_VERIFIED");
  return { resumePlan: prepareResumeActions(state.match, state.input.language) };
}
