import { AgenticError } from "../../../core/errors.ts";
import type { VoicePreparationState, VoiceEvaluationState } from "../agent/state";

export function voicePreparationAssembleNode(state: typeof VoicePreparationState.State) {
  if (!state.verified || !state.plan) throw new AgenticError("AGENT_RUN_FAILED", 502);
  return { result: state.plan };
}
export function voiceEvaluationAssembleNode(state: typeof VoiceEvaluationState.State) {
  if (!state.verified || !state.report) throw new AgenticError("AGENT_RUN_FAILED", 502);
  return { result: state.report };
}
