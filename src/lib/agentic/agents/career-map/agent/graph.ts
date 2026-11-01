import { START, END, StateGraph } from "@langchain/langgraph";
import { tracedNode } from "../../../core/nodes/traced-node.ts";
import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { CareerMapState } from "./state";
import { careerMapContextNode } from "../nodes/context.node";
import { careerMapEvidenceNode } from "../nodes/evidence.node";
import { careerMapRankNode } from "../nodes/rank.node";
import { careerMapRoadmapNode } from "../nodes/roadmap.node";
import { careerMapVerifyNode } from "../nodes/verify.node";
import { careerMapAssembleNode } from "../nodes/assemble.node";

/** Read-only orchestration. The caller persists only the final verified graph. */
export function createCareerMapGraph(scope: ExecutionScope) {
  return new StateGraph(CareerMapState)
    .addNode("context", tracedNode(scope, "career-map.context", careerMapContextNode))
    .addNode("evidence", tracedNode(scope, "career-map.evidence", careerMapEvidenceNode))
    .addNode("rank", tracedNode(scope, "career-map.rank", careerMapRankNode))
    .addNode("roadmap", tracedNode(scope, "career-map.roadmap", careerMapRoadmapNode))
    .addNode("verify", tracedNode(scope, "career-map.verify", careerMapVerifyNode))
    .addNode("assemble", tracedNode(scope, "career-map.assemble", careerMapAssembleNode))
    .addEdge(START, "context")
    .addEdge("context", "evidence")
    .addEdge("evidence", "rank")
    .addEdge("rank", "roadmap")
    .addEdge("roadmap", "verify")
    .addEdge("verify", "assemble")
    .addEdge("assemble", END)
    .compile();
}
