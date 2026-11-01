import type { ApplicationSuggestionState } from "../agent/state";
import type { ApplicationSuggestionDependencies } from "../tools/contracts.tool";
import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { AgenticError } from "../../../core/errors.ts";

export function createApplicationGenerateNode(scope: ExecutionScope, deps: ApplicationSuggestionDependencies) {
  return async (state: typeof ApplicationSuggestionState.State) => {
    scope.budget.assertActive();
    try {
      const draft = await deps.generateEmail(state.input, scope.budget.signal);
      scope.budget.assertActive();
      return { draft };
    } catch (error) {
      scope.budget.assertActive();
      if (error instanceof AgenticError) throw error;
      // Project provider errors into the existing safe agent errors. Never leak vendor text.
      if (error && typeof error === "object" && "status" in error && typeof error.status === "number") {
        if ([402, 429].includes(error.status)) throw new AgenticError("AGENT_MODEL_QUOTA_DENIED", 429);
        if ([401, 403].includes(error.status)) throw new AgenticError("AGENT_ACCESS_DENIED", 403);
      }
      throw new AgenticError("AGENT_MODEL_UNAVAILABLE", 503);
    }
  };
}
