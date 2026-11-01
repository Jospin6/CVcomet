import type { InterviewPreparationState, InterviewEvaluationState } from "../agent/state";
import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { AgenticError } from "../../../core/errors.ts";
import type { InterviewTextDependencies } from "../tools/contracts.tool";

function throwIfInterrupted(scope: ExecutionScope) { scope.budget.assertActive(); }
function recoverable(error: unknown): boolean {
  // Never hide cancellation, deadlines, identity, permission or invalid payload failures.
  return !(error instanceof AgenticError);
}

export function createPreparationGenerateNode(scope: ExecutionScope, deps: InterviewTextDependencies) {
  return async (state: typeof InterviewPreparationState.State) => {
    if (!deps.generateQuestions) return { draft: null };
    try {
      throwIfInterrupted(scope);
      const draft = await deps.generateQuestions(state.input, scope.budget.signal);
      throwIfInterrupted(scope);
      return { draft };
    } catch (error) {
      throwIfInterrupted(scope);
      // Preserve the original quota 429 contract on preparation requests.
      if (!recoverable(error) || (typeof error === "object" && error !== null && "status" in error && error.status === 429)) throw error;
      return { draft: null };
    }
  };
}

export function createEvaluationGenerateNode(scope: ExecutionScope, deps: InterviewTextDependencies) {
  return async (state: typeof InterviewEvaluationState.State) => {
    if (!deps.evaluateAnswer) return { draft: null };
    try {
      throwIfInterrupted(scope);
      const draft = await deps.evaluateAnswer(state.input, scope.budget.signal);
      throwIfInterrupted(scope);
      return { draft };
    } catch (error) {
      throwIfInterrupted(scope);
      // A provider/quota failure cannot turn into a made-up score. It is ungraded.
      if (!recoverable(error)) throw error;
      return { draft: null };
    }
  };
}
