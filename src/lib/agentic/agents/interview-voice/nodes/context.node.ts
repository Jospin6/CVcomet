import type { VoicePreparationState, VoiceEvaluationState } from "../agent/state";
import { assertVoiceEvaluationInput, assertVoicePreparationInput } from "../tools/validation.tool";

export function voicePreparationContextNode(state: typeof VoicePreparationState.State) {
  assertVoicePreparationInput(state.input);
  return { verified: false };
}
export function voiceEvaluationContextNode(state: typeof VoiceEvaluationState.State) {
  assertVoiceEvaluationInput(state.input);
  return { draft: null, verified: false };
}
