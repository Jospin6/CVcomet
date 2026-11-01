import type { LetterEditState } from "../agent/state";
import { planLetterEdit } from "../tools/plan-edit.tool";
export function planLetterNode(state: typeof LetterEditState.State) {
  if (!state.input) throw new Error("LETTER_INPUT_REQUIRED");
  return { plan: planLetterEdit(state.input) };
}
