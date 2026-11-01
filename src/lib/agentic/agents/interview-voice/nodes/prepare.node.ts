import type { VoicePreparationState } from "../agent/state";
import { buildVoiceInstructions } from "../prompts/voice.prompt";

export function voicePrepareNode(state: typeof VoicePreparationState.State) {
  return { plan: buildVoiceInstructions(state.input) };
}
