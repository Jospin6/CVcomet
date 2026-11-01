import type { JobMatchAgentState } from "../agent/state";
import { validateSavedJobAnalysis } from "../tools/plan.tool";

export function planJobMatchNode(state: typeof JobMatchAgentState.State) {
  return { saved: validateSavedJobAnalysis(state.input.savedAnalysis, state.input.description) };
}
