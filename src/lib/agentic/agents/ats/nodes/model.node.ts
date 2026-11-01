import type { ExecutionScope } from "../../../core/execution/runner.ts";
import type { AtsAgentState } from "../agent/state";
import { prepareAtsModel, type AtsAgentDependencies } from "../tools/analysis.tool";

export function createAtsModelNode(scope: ExecutionScope, deps: AtsAgentDependencies) {
  return async (state: typeof AtsAgentState.State) => {
    if (!state.plan) throw new Error("ATS_PLAN_REQUIRED");
    return prepareAtsModel(scope.identity, scope.budget.signal, deps);
  };
}
