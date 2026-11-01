import type { ExecutionScope } from "../../../core/execution/runner.ts";
import type { ResumeFieldState } from "../agent/field-state";
import { generateResumeFieldTool, type FieldModel } from "../tools/field-generation.tool";

export function createResumeFieldGenerateNode(scope: ExecutionScope, provider?: FieldModel) {
  return async (state: typeof ResumeFieldState.State) => {
    if (!state.input || !state.prompt) throw new Error("RESUME_FIELD_INPUT_REQUIRED");
    return { draft: await generateResumeFieldTool(scope.identity, state.input,
      state.prompt, scope.budget.signal, provider) };
  };
}
