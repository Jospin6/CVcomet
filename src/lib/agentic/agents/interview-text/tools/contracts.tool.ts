import type { CoachFeedback, CoachLanguage, CoachQuestion, CoachRubric } from "@/lib/career/interview-coach-policy";

export type InterviewPreparationInput = Readonly<{
  role: string; level: string; language: CoachLanguage; questionCount: 5 | 10 | 15 | 20;
  jobDescription: string; resumeContext: string; profile: string; factsFromProfile: unknown;
}>;
export type InterviewQuestionDraft = Readonly<{
  questions: CoachQuestion[]; recruiterQuestions: string[];
}>;
export type InterviewPreparationResult = Readonly<{
  questions: CoachQuestion[]; recruiterQuestions: string[];
  source: "model" | "fallback";
}>;
export type InterviewEvaluationInput = Readonly<{
  question: string; answer: string; language: CoachLanguage; role: string;
}>;
export type InterviewEvaluationDraft = Readonly<CoachRubric & {
  strength: string; improvement: string; nextExercise: string; evidenceQuote: string;
}>;
export type InterviewEvaluationResult = Readonly<{ feedback: CoachFeedback }>;

/** Provider + quota belong to the already-authorized service, never to graph state. */
export type InterviewTextDependencies = Readonly<{
  generateQuestions?: (input: InterviewPreparationInput, signal: AbortSignal) => Promise<InterviewQuestionDraft>;
  evaluateAnswer?: (input: InterviewEvaluationInput, signal: AbortSignal) => Promise<InterviewEvaluationDraft>;
}>;
