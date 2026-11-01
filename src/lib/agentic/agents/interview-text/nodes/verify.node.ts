import type { InterviewPreparationState, InterviewEvaluationState } from "../agent/state";
import { verifyQuestionSet, verifyEvaluationDraft, isVerifiedFeedback } from "../tools/validation.tool";

export function preparationVerifyNode(state: typeof InterviewPreparationState.State) {
  const result = verifyQuestionSet(state.draft, state.defaults, state.input.questionCount, state.input.language);
  return { questions: result.questions, recruiterQuestions: result.recruiterQuestions, verified: true,
    result };
}
export function evaluationVerifyNode(state: typeof InterviewEvaluationState.State) {
  const feedback = verifyEvaluationDraft(state.draft, state.input);
  return { feedback, verified: isVerifiedFeedback(feedback) };
}
