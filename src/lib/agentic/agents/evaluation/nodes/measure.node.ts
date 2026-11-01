import type { EvaluationState } from "../agent/state";
import { assembleEvaluation } from "../tools/metrics.tool";
export function evaluationMeasureNode(state: typeof EvaluationState.State) {
  return { view: assembleEvaluation(state.evidence) };
}
