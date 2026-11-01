import type { SupervisorState } from "../agent/state";
import type { SupervisorDependencies } from "../tools/contracts.tool";
import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { assertSupervisorPlan } from "../tools/routing.tool";

export function createSupervisorRouteNode(scope: ExecutionScope, deps: SupervisorDependencies) {
  return async (state: typeof SupervisorState.State) => {
    scope.budget.assertActive();
    const proposed = await deps.selectPlan(state.input, scope.budget.signal);
    scope.budget.assertActive();
    return { plan: assertSupervisorPlan(proposed, state.input.applicationId) };
  };
}
