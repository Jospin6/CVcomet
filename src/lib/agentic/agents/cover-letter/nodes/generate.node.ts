import type { ExecutionScope } from "../../../core/execution/runner.ts";
import type { LetterEditState } from "../agent/state";
import { generateLetterEdit, type LetterEditModel } from "../tools/generate-edit.tool";
export function createGenerateLetterNode(scope: ExecutionScope, model?: LetterEditModel) {
  return async (state: typeof LetterEditState.State) => {
    if (!state.input || !state.plan || state.plan.mode === "clarification") throw new Error("LETTER_PLAN_REQUIRED");
    return { draft: await generateLetterEdit(scope.identity, state.input, scope.budget.signal, model) };
  };
}
