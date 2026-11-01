import type { ResumeFieldState } from "../agent/field-state";
import { checkGeneratedResumeField } from "../tools/field-review.tool";

export function verifyResumeFieldNode(state: typeof ResumeFieldState.State) {
  if (!state.input) throw new Error("RESUME_FIELD_INPUT_REQUIRED");
  return checkGeneratedResumeField(state.input, state.draft);
}
