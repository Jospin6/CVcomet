import { START, END, StateGraph } from "@langchain/langgraph";
import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { tracedNode } from "../../../core/nodes/traced-node.ts";
import { JobMatchAgentState } from "./state";
import { planJobMatchNode } from "../nodes/plan.node";
import { createExtractJobNode } from "../nodes/extract.node";
import { compareJobMatchNode } from "../nodes/compare.node";
import { verifyJobMatchNode } from "../nodes/verify.node";
import { prioritizeJobMatchNode } from "../nodes/prioritize.node";
import { assembleJobMatchNode } from "../nodes/assemble.node";
import type { JobMatchDependencies } from "../tools/extract.tool";

/** No checkpointer and no persistence side effects: HTTP route remains owner of
 * auth, quota, cache and Prisma transaction. */
export function createJobMatchGraph(scope: ExecutionScope, deps: JobMatchDependencies = {}) {
  return new StateGraph(JobMatchAgentState)
    .addNode("plan", tracedNode(scope, "job-match.plan", planJobMatchNode))
    .addNode("extract", tracedNode(scope, "job-match.extract", createExtractJobNode(deps, scope)))
    .addNode("compare", tracedNode(scope, "job-match.compare", compareJobMatchNode))
    .addNode("verify", tracedNode(scope, "job-match.verify", verifyJobMatchNode))
    .addNode("prioritize", tracedNode(scope, "job-match.prioritize", prioritizeJobMatchNode))
    .addNode("assemble", tracedNode(scope, "job-match.assemble", assembleJobMatchNode))
    .addEdge(START, "plan")
    .addEdge("plan", "extract")
    .addEdge("extract", "compare")
    .addEdge("compare", "verify")
    .addEdge("verify", "prioritize")
    .addEdge("prioritize", "assemble")
    .addEdge("assemble", END)
    .compile();
}
