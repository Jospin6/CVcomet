import type { LetterCreationState } from "../agent/creation-state";
import { planLetterCreation } from "../tools/plan-creation.tool";
export function planCreationNode(state: typeof LetterCreationState.State) {
  if (!state.input) throw new Error("LETTER_CREATION_INPUT_REQUIRED");
  return { plan: planLetterCreation(state.input) };
}
