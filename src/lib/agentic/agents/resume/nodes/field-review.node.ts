import type { ResumeFieldState } from "../agent/field-state";

/** User decides whether to insert the returned text in the editor. No writes. */
export function reviewResumeFieldNode(state: typeof ResumeFieldState.State) {
  return { readyForReview: Boolean(state.proposal) && !state.issue };
}
