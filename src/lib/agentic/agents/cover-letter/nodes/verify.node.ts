import type { LetterEditState } from "../agent/state";
import { verifyLetterEdit } from "../tools/verify-edit.tool";
export function verifyLetterNode(state: typeof LetterEditState.State) {
  if (!state.input || !state.draft) throw new Error("LETTER_DRAFT_REQUIRED");
  return { result: verifyLetterEdit(state.input, state.draft) };
}
