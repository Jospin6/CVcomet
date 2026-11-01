import { AgenticError } from "../../../core/errors.ts";
import { boundedQuestions, fallbackQuestions, rubricScore, safeEvidenceQuote, ungradedFeedback, COACH_DISCLAIMER, type CoachFeedback, type CoachLanguage, type CoachQuestion } from "@/lib/career/interview-coach-policy";
import type { InterviewPreparationInput, InterviewPreparationResult, InterviewQuestionDraft, InterviewEvaluationInput, InterviewEvaluationDraft } from "./contracts.tool";

function invalid(): never { throw new AgenticError("AGENT_MODEL_INPUT_INVALID", 400); }
export function assertPreparationInput(input: InterviewPreparationInput): void {
  if (!input || typeof input.role !== "string" || input.role.trim().length < 2 || input.role.length > 160 ||
    typeof input.level !== "string" || input.level.length > 80 || !["fr", "en"].includes(input.language) ||
    ![5,10,15,20].includes(input.questionCount) || typeof input.jobDescription !== "string" || input.jobDescription.length > 12_000 ||
    typeof input.resumeContext !== "string" || input.resumeContext.length > 12_000 ||
    typeof input.profile !== "string" || input.profile.length > 12_000) invalid();
}
export function assertEvaluationInput(input: InterviewEvaluationInput): void {
  if (!input || typeof input.question !== "string" || input.question.trim().length < 5 || input.question.length > 500 ||
    typeof input.answer !== "string" || input.answer.trim().length < 2 || input.answer.length > 8_000 ||
    !["fr", "en"].includes(input.language) || typeof input.role !== "string" || input.role.length > 160) invalid();
}

/** Model's first-person suggested achievements are NOT evidence. Convert to coaching guidance. */
export function coachOnlyAnswer(value: string, language: CoachLanguage): string {
  const text = value.trim();
  if (!text || text.length > 1_500 || /\b(?:i|we|my|our|je|nous|mon|ma|mes)\b|j[’']|\b\d+(?:[.,]\d+)?\s*%|[$€£]\s*\d/i.test(text)) {
    return language === "fr"
      ? "Préparez une réponse fondée sur une situation réelle, votre action précise et un résultat vérifiable."
      : "Describe a real situation, your exact contribution, and a verifiable outcome.";
  }
  return text;
}

export function verifyQuestionSet(draft: InterviewQuestionDraft | null, defaults: InterviewPreparationResult, count: number, language: CoachLanguage): InterviewPreparationResult {
  if (!draft || !Array.isArray(draft.questions)) return defaults;
  const cleaned: CoachQuestion[] = draft.questions.filter((q): q is CoachQuestion =>
    !!q && typeof q.question === "string" && q.question.trim().length >= 5 && q.question.length <= 500 &&
    typeof q.focus === "string" && q.focus.length <= 120 && typeof q.suggestedAnswer === "string")
    .map(q => ({ question: q.question.trim(), focus: q.focus.trim(), suggestedAnswer: coachOnlyAnswer(q.suggestedAnswer, language) }));
  const questions = boundedQuestions(cleaned, count, language);
  const recruiterQuestions = Array.isArray(draft.recruiterQuestions)
    ? [...new Set(draft.recruiterQuestions.filter((q): q is string => typeof q === "string" && q.trim().length >= 5 && q.length <= 400).map(q=>q.trim()))].slice(0, 10)
    : [];
  return { questions, recruiterQuestions: recruiterQuestions.length ? recruiterQuestions : defaults.recruiterQuestions,
    source: cleaned.length ? "model" : "fallback" };
}

export function defaultPreparation(count: number, language: CoachLanguage): InterviewPreparationResult {
  return { questions: fallbackQuestions(count, language),
    recruiterQuestions: language === "fr" ? ["Quels résultats attendez-vous pendant les trois premiers mois ?", "Comment l'équipe collabore-t-elle ?"] :
      ["What outcomes matter in the first three months?", "How does the team collaborate?"], source: "fallback" };
}

export function verifyEvaluationDraft(draft: InterviewEvaluationDraft | null, input: InterviewEvaluationInput): CoachFeedback {
  if (!draft || typeof draft !== "object") return ungradedFeedback(input.language);
  const {relevance, specificity, structure, clarity} = draft;
  const criteria = { relevance, specificity, structure, clarity };
  let score: number;
  try { score = rubricScore(criteria); } catch { return ungradedFeedback(input.language); }
  if (typeof draft.strength !== "string" || draft.strength.length > 240 ||
      typeof draft.improvement !== "string" || draft.improvement.trim().length < 5 || draft.improvement.length > 300 ||
      typeof draft.nextExercise !== "string" || draft.nextExercise.trim().length < 5 || draft.nextExercise.length > 300 ||
      typeof draft.evidenceQuote !== "string" || draft.evidenceQuote.length > 160) {
    return ungradedFeedback(input.language);
  }
  return {status: "evaluated", score, criteria, strength: draft.strength.trim(),
    improvement: draft.improvement.trim(), nextExercise: draft.nextExercise.trim(),
    evidenceQuote: safeEvidenceQuote(draft.evidenceQuote, input.answer), disclaimer: COACH_DISCLAIMER};
}

export function isVerifiedFeedback(feedback: CoachFeedback): boolean {
  if (feedback.status === "unavailable") return feedback.score === null && feedback.criteria === null && feedback.evidenceQuote === "";
  return feedback.status === "evaluated" && feedback.criteria !== null && typeof feedback.score === "number" && feedback.score === rubricScore(feedback.criteria) &&
    feedback.score >= 0 && feedback.score <= 100;
}
