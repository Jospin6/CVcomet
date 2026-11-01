import { START, END, StateGraph } from "@langchain/langgraph";
import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { tracedNode } from "../../../core/nodes/traced-node.ts";
import { JobDiscoveryState } from "./state";
import { contextJobDiscoveryNode } from "../nodes/context.node";
import { createDiscoverJobsNode } from "../nodes/discover.node";
import { filterJobsNode } from "../nodes/filter.node";
import { rankJobsNode } from "../nodes/rank.node";
import { createMatchJobsNode } from "../nodes/match.node";
import { assembleDiscoveryNode } from "../nodes/assemble.node";
import type { JobDiscoveryDependencies } from "../tools/contracts.tool";

/** Read-only job discovery. No checkpoints or side effects inside the graph. */
export function createJobDiscoveryGraph(scope: ExecutionScope, deps: JobDiscoveryDependencies = {}) {
  return new StateGraph(JobDiscoveryState)
    .addNode("context", tracedNode(scope, "job-discovery.context", contextJobDiscoveryNode))
    .addNode("discover", tracedNode(scope, "job-discovery.discover", createDiscoverJobsNode(deps, scope)))
    .addNode("filter", tracedNode(scope, "job-discovery.filter", filterJobsNode))
    .addNode("rank", tracedNode(scope, "job-discovery.rank", rankJobsNode))
    .addNode("match", tracedNode(scope, "job-discovery.match", createMatchJobsNode(deps, scope)))
    .addNode("assemble", tracedNode(scope, "job-discovery.assemble", assembleDiscoveryNode))
    .addEdge(START, "context")
    .addEdge("context", "discover")
    .addEdge("discover", "filter")
    .addEdge("filter", "rank")
    .addEdge("rank", "match")
    .addEdge("match", "assemble")
    .addEdge("assemble", END)
    .compile();
}
