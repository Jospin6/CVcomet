import type { ExecutionScope } from "../../../core/execution/runner.ts";
import type { AtsAgentState } from "../agent/state";
import { runAtsJobMatch, type AtsAgentDependencies } from "../tools/analysis.tool";

export function createAtsJobMatchNode(scope: ExecutionScope, deps: AtsAgentDependencies) {
  return async (state: typeof AtsAgentState.State) => {
    if (!state.plan) throw new Error("ATS_PLAN_REQUIRED");
    return { jobMatch: await runAtsJobMatch(state, scope.budget.signal, deps) };
  };
}
