import type { LetterCreationState } from "../agent/creation-state";
/** User explicitly saves the returned draft via the existing SAVE endpoint. */
export function reviewCreationNode(state: typeof LetterCreationState.State) {
  return { readyForReview: Boolean(state.plan?.ready && state.verified) };
}
