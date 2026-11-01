import type { SupervisorState } from "../agent/state";
import type { SupervisorDependencies, SupervisorSpecialist } from "../tools/contracts.tool";
import type { ExecutionScope } from "../../../core/execution/runner.ts";

/** Dispatches only to the existing owner-scoped READ registry.
 * Write-capable specialist graphs require richer validated inputs and separate approval routes. */
export function createSupervisorDelegateNode(scope: ExecutionScope, deps: SupervisorDependencies, specialist: SupervisorSpecialist) {
  return async (state: typeof SupervisorState.State) => {
    if (state.plan.specialist !== specialist) throw new Error("SUPERVISOR_ROUTE_MISMATCH");
    scope.budget.assertActive();
    const { reads, steps } = await deps.readSelected(state.plan.calls, scope.budget.signal);
    scope.budget.assertActive();
    // Only a server-provided, owner-bound adapter may invoke a real specialist graph.
    // Missing typed inputs return null; no guessed resources or autonomous writes.
    const specialistResult = deps.delegateSpecialist
      ? await deps.delegateSpecialist(specialist, state.input, scope.budget.signal) : null;
    scope.budget.assertActive();
    return { reads, steps, specialistResult };
  };
}
