import type { InterviewPreparationState, InterviewEvaluationState } from "../agent/state";
import { defaultPreparation } from "../tools/validation.tool";

export function preparationContextNode(state: typeof InterviewPreparationState.State) {
  return { defaults: defaultPreparation(state.input.questionCount, state.input.language) };
}
export function evaluationContextNode(state: typeof InterviewEvaluationState.State) {
  return { draft: null };
}
