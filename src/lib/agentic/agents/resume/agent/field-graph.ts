import { END, START, StateGraph } from "@langchain/langgraph";
import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { tracedNode } from "../../../core/nodes/traced-node.ts";
import { planResumeFieldNode } from "../nodes/field-plan.node";
import { createResumeFieldGenerateNode } from "../nodes/field-generate.node";
import { verifyResumeFieldNode } from "../nodes/field-verify.node";
import { reviewResumeFieldNode } from "../nodes/field-review.node";
import type { FieldModel } from "../tools/field-generation.tool";
import { ResumeFieldState } from "./field-state";

/** Four-node graph for generating/rephrasing a field from candidate facts. */
export function createResumeFieldGraph(scope: ExecutionScope, provider?: FieldModel) {
  return new StateGraph(ResumeFieldState)
    .addNode("plan", tracedNode(scope, "resume.field.plan", planResumeFieldNode))
    .addNode("generate", tracedNode(scope, "resume.field.generate", createResumeFieldGenerateNode(scope, provider)))
    .addNode("verify", tracedNode(scope, "resume.field.verify", verifyResumeFieldNode))
    .addNode("review", tracedNode(scope, "resume.field.review", reviewResumeFieldNode))
    .addEdge(START, "plan")
    .addEdge("plan", "generate")
    .addEdge("generate", "verify")
    .addEdge("verify", "review")
    .addEdge("review", END)
    .compile();
}
