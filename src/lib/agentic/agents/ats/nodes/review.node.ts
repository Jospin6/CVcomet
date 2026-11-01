import type { ExecutionScope } from "../../../core/execution/runner.ts";
import type { AtsAgentState } from "../agent/state";
import { runAtsEvidenceReview, type AtsAgentDependencies } from "../tools/analysis.tool";

export function createAtsReviewNode(scope: ExecutionScope, deps: AtsAgentDependencies) {
  return async (state: typeof AtsAgentState.State) => {
    if (!state.plan) throw new Error("ATS_PLAN_REQUIRED");
    return { semantic: await runAtsEvidenceReview(state, scope.budget.signal, deps) };
  };
}
