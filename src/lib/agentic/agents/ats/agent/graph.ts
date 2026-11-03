import { START, END, StateGraph } from "@langchain/langgraph";
import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { tracedNode } from "../../../core/nodes/traced-node.ts";
import { AtsAgentState } from "./state";
import type { AtsExecutionProgress } from "./progress";
import { atsPlanNode } from "../nodes/plan.node";
import { createAtsModelNode } from "../nodes/model.node";
import { createAtsReviewNode } from "../nodes/review.node";
import { createAtsJobMatchNode } from "../nodes/job-match.node";
import { atsAssembleNode } from "../nodes/assemble.node";
import { atsVerifyNode } from "../nodes/verify.node";
import type { AtsAgentDependencies } from "../tools/analysis.tool";

/** Sequential evidence review and optional job analysis; deterministic rubric after both.
 * Node names MUST NOT collide with Annotation state keys (e.g. plan/model).
 * No checkpointer: the CV and untrusted job posting must not enter checkpoint storage. */
export function createAtsAgentGraph(scope: ExecutionScope, deps: AtsAgentDependencies = {}, progress?: AtsExecutionProgress) {
  const tracked = <TUpdate extends object>(name: string, work: (state: typeof AtsAgentState.State) => TUpdate | Promise<TUpdate>) =>
    tracedNode(scope, `ats.${name}`, async (state: typeof AtsAgentState.State) => {
      progress?.started.add(name);
      const update = await work(state);
      if (progress) Object.assign(progress.values, update);
      return update;
    });
  return new StateGraph(AtsAgentState)
    .addNode("plan-analysis", tracked("plan", atsPlanNode))
    .addNode("prepare-model", tracked("model", createAtsModelNode(scope, deps)))
    .addNode("review", tracked("review", createAtsReviewNode(scope, deps)))
    .addNode("job-match", tracked("job-match", createAtsJobMatchNode(scope, deps)))
    .addNode("assemble", tracked("assemble", atsAssembleNode))
    .addNode("verify", tracked("verify", atsVerifyNode))
    .addEdge(START, "plan-analysis")
    .addEdge("plan-analysis", "prepare-model")
    .addEdge("prepare-model", "review")
    .addEdge("review", "job-match")
    .addEdge("job-match", "assemble")
    .addEdge("assemble", "verify")
    .addEdge("verify", END)
    .compile();
}
