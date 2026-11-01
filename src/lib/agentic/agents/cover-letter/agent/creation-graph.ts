import { START, END, StateGraph } from "@langchain/langgraph";
import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { tracedNode } from "../../../core/nodes/traced-node.ts";
import { LetterCreationState } from "./creation-state";
import { planCreationNode } from "../nodes/plan-creation.node";
import { createGenerateCreationNode } from "../nodes/generate-creation.node";
import { verifyCreationNode } from "../nodes/verify-creation.node";
import { reviewCreationNode } from "../nodes/review-creation.node";
import type { LetterCreationModel } from "../tools/generate-creation.tool";

/** Job-based creation; generates a user-reviewable draft, never persists a letter. */
export function createLetterCreationGraph(scope: ExecutionScope, model?: LetterCreationModel) {
  return new StateGraph(LetterCreationState)
    .addNode("plan", tracedNode(scope, "cover-letter.creation.plan", planCreationNode))
    .addNode("generate", tracedNode(scope, "cover-letter.creation.generate", createGenerateCreationNode(scope, model)))
    .addNode("verify", tracedNode(scope, "cover-letter.creation.verify", verifyCreationNode))
    .addNode("review", tracedNode(scope, "cover-letter.creation.review", reviewCreationNode))
    .addEdge(START, "plan")
    .addConditionalEdges("plan", (state: typeof LetterCreationState.State) => state.plan?.ready ? "generate" : "review")
    .addEdge("generate", "verify")
    .addEdge("verify", "review")
    .addEdge("review", END)
    .compile();
}
