import { AgenticError } from "../../../core/errors.ts";
import type { InterviewPreparationState, InterviewEvaluationState } from "../agent/state";

export function preparationAssembleNode(state: typeof InterviewPreparationState.State) {
  if (!state.verified || state.questions.length !== state.input.questionCount) throw new AgenticError("AGENT_RUN_FAILED", 502);
  return { result: state.result };
}
export function evaluationAssembleNode(state: typeof InterviewEvaluationState.State) {
  if (!state.verified) throw new AgenticError("AGENT_RUN_FAILED", 502);
  return { result: {feedback: state.feedback} };
}
