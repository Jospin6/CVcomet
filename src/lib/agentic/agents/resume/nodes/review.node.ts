import type { ResumeAgentState } from "../agent/state";
import { clarifyResume } from "../tools/verify-edit.tool";

/** No LangGraph auto-write: the existing proposal/decision endpoints own approval,
 * expiry, evidence revisions, optimistic concurrency and version snapshots. */
export function reviewResumeNode(state: typeof ResumeAgentState.State) {
  if (state.plan?.mode === "clarification") {
    return { result: clarifyResume(state.plan.message || "Please clarify the job posting."), readyForReview: false };
  }
  if (!state.result) throw new Error("RESUME_REVIEW_MISSING");
  return { readyForReview: state.result.object.status === "applied" && !!state.result.document };
}
