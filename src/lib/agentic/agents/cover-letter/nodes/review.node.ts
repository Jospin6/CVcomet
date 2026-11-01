import type { LetterEditState } from "../agent/state";
import { clarifyLetter } from "../tools/verify-edit.tool";
/** No graph-side approval or mutation: the existing proposal endpoint owns the review. */
export function reviewLetterNode(state: typeof LetterEditState.State) {
  if (state.plan?.mode === "clarification") {
    return { result: clarifyLetter(state.plan.message || "Please clarify your request."), readyForReview: false };
  }
  if (!state.result) throw new Error("LETTER_RESULT_REQUIRED");
  return { readyForReview: state.result.status === "proposal" && !!state.result.document };
}
