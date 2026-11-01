import { Annotation } from "@langchain/langgraph";
import type { CoachFeedback, CoachLanguage, CoachQuestion } from "@/lib/career/interview-coach-policy";
import type { InterviewPreparationInput, InterviewPreparationResult, InterviewEvaluationInput, InterviewEvaluationResult, InterviewQuestionDraft, InterviewEvaluationDraft } from "../tools/contracts.tool";

/** Transient state: never checkpoint answers, resumes, employer text or profile content. */
export const InterviewPreparationState = Annotation.Root({
  input: Annotation<InterviewPreparationInput>,
  defaults: Annotation<InterviewPreparationResult>,
  draft: Annotation<InterviewQuestionDraft | null>,
  questions: Annotation<CoachQuestion[]>,
  recruiterQuestions: Annotation<string[]>,
  verified: Annotation<boolean>,
  result: Annotation<InterviewPreparationResult>,
});

export const InterviewEvaluationState = Annotation.Root({
  input: Annotation<InterviewEvaluationInput>,
  draft: Annotation<InterviewEvaluationDraft | null>,
  feedback: Annotation<CoachFeedback>,
  verified: Annotation<boolean>,
  result: Annotation<InterviewEvaluationResult>,
});

export type InterviewLanguage = CoachLanguage;
