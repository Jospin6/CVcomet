import type { SupervisorState } from "../agent/state";
import type { SupervisorDependencies } from "../tools/contracts.tool";
import type { ExecutionScope } from "../../../core/execution/runner.ts";

export function createSupervisorRespondNode(scope: ExecutionScope, deps: SupervisorDependencies) {
  return async (state: typeof SupervisorState.State) => {
    scope.budget.assertActive();
    const answer = await deps.respond({ context: state.input, specialist: state.plan.specialist, reads: state.reads, specialistResult: state.specialistResult }, scope.budget.signal);
    scope.budget.assertActive();
    return { answer };
  };
}
