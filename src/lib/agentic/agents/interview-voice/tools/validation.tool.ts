import { AgenticError } from "../../../core/errors.ts";
import { countUsableAnswers, screeningDimensionKeys, screeningOverallScore } from "@/lib/career/screening-policy";
import type {
  VoiceEvaluationDraft, VoiceEvaluationInput, VoicePreparationInput, VoicePreparationResult,
  VoiceReport, VoiceTurn, VoiceEvidence,
} from "./contracts.tool";

const fail = (): never => { throw new AgenticError("AGENT_MODEL_INPUT_INVALID", 400); };
const sized = (s: unknown, max: number): s is string => typeof s === "string" && s.length <= max;
const uuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export function assertVoicePreparationInput(value: VoicePreparationInput): void {
  if (!value || typeof value !== "object" || !sized(value.sessionId, 36) || !uuid(value.sessionId) ||
    value.roomName !== `cvcomet-screening-${value.sessionId}` ||
    !["fr", "en"].includes(value.language) ||
    !sized(value.jobTitle, 240) || !sized(value.company, 240) || !sized(value.location, 240) ||
    !sized(value.jobDescription, 12000) || !value.jobDescription.trim() ||
    !sized(value.resumeText, 14000) || !value.resumeText.trim()) fail();
}

export function assertVoiceEvaluationInput(value: VoiceEvaluationInput): void {
  if (!value || typeof value !== "object" || !["fr", "en"].includes(value.language) ||
    !sized(value.jobTitle, 240) || !sized(value.company, 240) ||
    !sized(value.jobDescription, 12000) || !sized(value.resumeText, 14000) ||
    !Array.isArray(value.turns) || value.turns.length > 60 ||
    value.turns.some((t: VoiceTurn) => !t || !["user", "assistant"].includes(t.role) || !sized(t.text, 3000) || !t.text.trim())) fail();
}

export function assertVoicePlan(result: VoicePreparationResult): void {
  if (!result || !sized(result.instructions, 29000) || result.instructions.length < 150 ||
    !sized(result.openingInstructions, 500) || result.openingInstructions.length < 20 ||
    !["fr", "en"].includes(result.language)) fail();
}

const disclaimer = "Practice feedback only; not a hiring prediction.";
export function unavailableVoiceReport(input: VoiceEvaluationInput): VoiceReport {
  const answers = countUsableAnswers(input.turns);
  return {
    kind: "AI_SCREENING", status: "unavailable",
    reason: answers < 2 ? "INSUFFICIENT_ANSWERS" : "EVALUATION_UNAVAILABLE",
    dimensions: null, overallScore: null, answers, evidence: [],
    summary: input.language === "fr" ? "Évaluation non disponible." : "Evaluation unavailable.",
    strengths: [], improvements: [], recommendedAction: "", disclaimer,
  };
}

const cleanLine = (s: unknown, max: number): s is string =>
  typeof s === "string" && s.trim().length > 0 && s.length <= max;

/** Model scores are NEVER accepted without independently checked verbatim candidate evidence. */
export function verifyVoiceEvaluationDraft(raw: VoiceEvaluationDraft | null, input: VoiceEvaluationInput): VoiceReport {
  const unavailable = unavailableVoiceReport(input);
  if (unavailable.answers < 2 || !raw || typeof raw !== "object" || !raw.dimensions ||
    !Array.isArray(raw.evidence) || raw.evidence.length < 2 || raw.evidence.length > 6 ||
    !Array.isArray(raw.strengths) || raw.strengths.length > 4 ||
    !Array.isArray(raw.improvements) || raw.improvements.length > 4 ||
    !raw.strengths.every(s => cleanLine(s, 240)) ||
    !raw.improvements.every(s => cleanLine(s, 240)) ||
    !cleanLine(raw.summary, 650) || !cleanLine(raw.recommendedAction, 350)) return unavailable;

  let score: number;
  try { score = screeningOverallScore(raw.dimensions); } catch { return unavailable; }
  const candidateTurns = input.turns.filter(t => t.role === "user").map(t => t.text.toLowerCase().replace(/\s+/g, " ").trim());
  const matchedAnswers = new Set<number>();
  const evidence: VoiceEvidence[] = [];
  for (const entry of raw.evidence) {
    if (!entry || !screeningDimensionKeys.includes(entry.dimension) || !cleanLine(entry.quote, 240) || entry.quote.trim().length < 12) return unavailable;
    const quote = entry.quote.toLowerCase().replace(/\s+/g, " ").trim();
    const answerIndex = candidateTurns.findIndex(text => text.includes(quote));
    if (answerIndex === -1) return unavailable;
    matchedAnswers.add(answerIndex);
    evidence.push({ dimension: entry.dimension, quote: entry.quote.trim() });
  }
  // Two separate answers must substantiate the pedagogical assessment.
  if (matchedAnswers.size < 2) return unavailable;
  return {
    kind: "AI_SCREENING", status: "evaluated", dimensions: raw.dimensions,
    overallScore: score, answers: unavailable.answers, evidence,
    strengths: raw.strengths.map(s => s.trim()),
    improvements: raw.improvements.map(s => s.trim()),
    recommendedAction: raw.recommendedAction.trim(), summary: raw.summary.trim(), disclaimer,
  };
}
