import type { ResumeAgentState } from "../agent/state";
import { verifyResumeEdit } from "../tools/verify-edit.tool";

export function verifyResumeNode(state: typeof ResumeAgentState.State) {
  if (!state.input || !state.draft) throw new Error("RESUME_DRAFT_REQUIRED");
  return { result: verifyResumeEdit(state.input, state.draft) };
}
