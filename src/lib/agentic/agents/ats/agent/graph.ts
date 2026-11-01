import { START, END, StateGraph } from "@langchain/langgraph";
import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { tracedNode } from "../../../core/nodes/traced-node.ts";
import { AtsAgentState } from "./state";
import { atsPlanNode } from "../nodes/plan.node";
import { createAtsModelNode } from "../nodes/model.node";
import { createAtsReviewNode } from "../nodes/review.node";
import { createAtsJobMatchNode } from "../nodes/job-match.node";
import { atsAssembleNode } from "../nodes/assemble.node";
import { atsVerifyNode } from "../nodes/verify.node";
import type { AtsAgentDependencies } from "../tools/analysis.tool";

/** Parallel evidence review and optional job analysis; deterministic rubric after join.
 * No checkpointer: the CV and untrusted job posting must not enter checkpoint storage. */
export function createAtsAgentGraph(scope: ExecutionScope, deps: AtsAgentDependencies = {}) {
  return new StateGraph(AtsAgentState)
    .addNode("plan", tracedNode(scope, "ats.plan", atsPlanNode))
    .addNode("model", tracedNode(scope, "ats.model", createAtsModelNode(scope, deps)))
    .addNode("review", tracedNode(scope, "ats.review", createAtsReviewNode(scope, deps)))
    .addNode("job-match", tracedNode(scope, "ats.job-match", createAtsJobMatchNode(scope, deps)))
    .addNode("assemble", tracedNode(scope, "ats.assemble", atsAssembleNode))
    .addNode("verify", tracedNode(scope, "ats.verify", atsVerifyNode))
    .addEdge(START, "plan")
    .addEdge("plan", "model")
    .addEdge("model", "review")
    .addEdge("model", "job-match")
    .addEdge(["review", "job-match"], "assemble")
    .addEdge("assemble", "verify")
    .addEdge("verify", END)
    .compile();
}
