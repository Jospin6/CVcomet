import { END, START, StateGraph } from "@langchain/langgraph";
import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { tracedNode } from "../../../core/nodes/traced-node.ts";
import { planResumeNode } from "../nodes/plan.node";
import { createResumeGenerateNode } from "../nodes/generate.node";
import { verifyResumeNode } from "../nodes/verify.node";
import { reviewResumeNode } from "../nodes/review.node";
import type { ResumeAgentDependencies } from "../tools/generate-edit.tool";
import { ResumeAgentState } from "./state";

/** Real branching LangGraph. Content remains ephemeral; the persistent review
 * artifact is created separately by the existing Prisma proposal service. */
export function createResumeAgentGraph(scope: ExecutionScope, deps: ResumeAgentDependencies = {}) {
  return new StateGraph(ResumeAgentState)
    .addNode("plan", tracedNode(scope, "resume.plan", planResumeNode))
    .addNode("generate", tracedNode(scope, "resume.generate", createResumeGenerateNode(scope, deps)))
    .addNode("verify", tracedNode(scope, "resume.verify", verifyResumeNode))
    .addNode("review", tracedNode(scope, "resume.review", reviewResumeNode))
    .addEdge(START, "plan")
    .addConditionalEdges("plan", (state) => state.plan?.mode === "clarification" ? "review" : "generate")
    .addEdge("generate", "verify")
    .addEdge("verify", "review")
    .addEdge("review", END)
    .compile();
}
