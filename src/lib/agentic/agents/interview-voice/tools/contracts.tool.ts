import type { ScreeningDimension, ScreeningDimensions } from "@/lib/career/screening-policy";

export type VoiceLanguage = "fr" | "en";
export type VoiceTurn = { role: "user" | "assistant"; text: string };

/** The caller has already proved session ownership, consent and room binding. */
export type VoicePreparationInput = {
  sessionId: string;
  roomName: string;
  language: VoiceLanguage;
  jobTitle: string;
  company: string;
  location: string;
  jobDescription: string;
  resumeText: string;
};
export type VoicePreparationResult = Pick<VoicePreparationInput, "sessionId" | "roomName" | "language"> & {
  instructions: string;
  openingInstructions: string;
};

export type VoiceEvaluationInput = {
  language: VoiceLanguage;
  jobTitle: string;
  company: string;
  jobDescription: string;
  resumeText: string;
  turns: VoiceTurn[];
};
export type VoiceEvidence = { dimension: ScreeningDimension; quote: string };
export type VoiceEvaluationDraft = {
  dimensions: ScreeningDimensions;
  evidence: VoiceEvidence[];
  strengths: string[];
  improvements: string[];
  recommendedAction: string;
  summary: string;
};
export type VoiceReport = {
  kind: "AI_SCREENING";
  status: "evaluated" | "unavailable";
  reason?: "INSUFFICIENT_ANSWERS" | "EVALUATION_UNAVAILABLE";
  dimensions: ScreeningDimensions | null;
  overallScore: number | null;
  answers: number;
  evidence: VoiceEvidence[];
  summary: string;
  strengths: string[];
  improvements: string[];
  recommendedAction: string;
  disclaimer: string;
};
export type VoiceDependencies = {
  evaluateTranscript?: (input: VoiceEvaluationInput, signal: AbortSignal) => Promise<VoiceEvaluationDraft | null>;
};
