import type { ExecutionScope } from "../../../core/execution/runner.ts";
import type { LetterCreationState } from "../agent/creation-state";
import { generateLetterCreation, type LetterCreationModel } from "../tools/generate-creation.tool";
export function createGenerateCreationNode(scope: ExecutionScope, model?: LetterCreationModel) {
  return async (state: typeof LetterCreationState.State) => {
    if (!state.input || !state.plan?.ready) throw new Error("LETTER_CREATION_PLAN_REQUIRED");
    return { draft: await generateLetterCreation(scope.identity, state.input, scope.budget.signal, model) };
  };
}
