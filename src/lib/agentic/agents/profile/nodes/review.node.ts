import type { ProfileAgentState } from "../agent/state";

/** Human approval is the existing confirmed PUT /api/career-profile guarded by
 * optimistic revision, not an LLM-generated decision. No auto-save node exists. */
export function reviewNode(state: typeof ProfileAgentState.State) {
  if (!state.review || !state.proposal) throw new Error("PROFILE_REVIEW_MISSING");
  return { readyForReview: true };
}
