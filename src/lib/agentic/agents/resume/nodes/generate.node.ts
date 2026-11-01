import type { ExecutionScope } from "../../../core/execution/runner.ts";
import type { ResumeAgentState } from "../agent/state";
import { generateResumeEditTool, type ResumeAgentDependencies } from "../tools/generate-edit.tool";

export function createResumeGenerateNode(scope: ExecutionScope, deps: ResumeAgentDependencies) {
  return async (state: typeof ResumeAgentState.State) => {
    if (!state.input || !state.plan || state.plan.mode === "clarification") throw new Error("RESUME_PLAN_REQUIRED");
    return { draft: await generateResumeEditTool(scope.identity, state.input, deps, scope.budget.signal) };
  };
}
