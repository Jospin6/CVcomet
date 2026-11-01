import type { EvaluationState } from "../agent/state";
import { evaluateStage19Gates } from "../tools/policy.tool";
export function evaluationGateNode(state: typeof EvaluationState.State) {
  return { result: { ...state.view, ...evaluateStage19Gates(state.view) } };
}
