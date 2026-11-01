import { Annotation } from "@langchain/langgraph";
import type {
  VoicePreparationInput, VoicePreparationResult, VoiceEvaluationInput, VoiceEvaluationDraft, VoiceReport,
} from "../tools/contracts.tool";

/** Ephemeral-only: no LangGraph checkpointer or user content in graph trace events. */
export const VoicePreparationState = Annotation.Root({
  input: Annotation<VoicePreparationInput>,
  plan: Annotation<VoicePreparationResult>,
  verified: Annotation<boolean>,
  result: Annotation<VoicePreparationResult>,
});
export const VoiceEvaluationState = Annotation.Root({
  input: Annotation<VoiceEvaluationInput>,
  draft: Annotation<VoiceEvaluationDraft | null>,
  report: Annotation<VoiceReport>,
  verified: Annotation<boolean>,
  result: Annotation<VoiceReport>,
});
