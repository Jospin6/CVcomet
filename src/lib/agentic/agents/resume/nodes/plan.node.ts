import type { ResumeAgentState } from "../agent/state";
import { planResumeEdit } from "../tools/plan-edit.tool";

export function planResumeNode(state: typeof ResumeAgentState.State) {
  if (!state.input) throw new Error("RESUME_INPUT_REQUIRED");
  return { plan: planResumeEdit(state.input) };
}
