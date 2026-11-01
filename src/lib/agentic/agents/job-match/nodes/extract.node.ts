import type { JobMatchAgentState } from "../agent/state";
import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { extractJobRequirements, type JobMatchDependencies } from "../tools/extract.tool";

export function createExtractJobNode(deps: JobMatchDependencies, scope: ExecutionScope) {
  return async (state: typeof JobMatchAgentState.State) => ({
    analysis: state.saved ?? await extractJobRequirements(state.input.description, state.input.language, scope.budget.signal, deps),
  });
}
