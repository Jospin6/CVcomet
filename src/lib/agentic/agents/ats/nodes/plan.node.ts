import type { AtsAgentState } from "../agent/state";
import { planAtsAnalysis } from "../tools/plan.tool";

export function atsPlanNode(state: typeof AtsAgentState.State) {
  if (!state.input) throw new Error("ATS_INPUT_REQUIRED");
  return { plan: planAtsAnalysis(state.input) };
}
