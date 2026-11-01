import type { VoicePreparationState, VoiceEvaluationState } from "../agent/state";
import { assertVoicePlan, verifyVoiceEvaluationDraft } from "../tools/validation.tool";

export function voicePreparationVerifyNode(state: typeof VoicePreparationState.State) {
  assertVoicePlan(state.plan);
  return { verified: true };
}
export function voiceEvaluationVerifyNode(state: typeof VoiceEvaluationState.State) {
  return { report: verifyVoiceEvaluationDraft(state.draft, state.input), verified: true };
}
