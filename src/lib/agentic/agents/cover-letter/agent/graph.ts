import { START, END, StateGraph } from "@langchain/langgraph";
import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { tracedNode } from "../../../core/nodes/traced-node.ts";
import { LetterEditState } from "./state";
import { planLetterNode } from "../nodes/plan.node";
import { createGenerateLetterNode } from "../nodes/generate.node";
import { verifyLetterNode } from "../nodes/verify.node";
import { reviewLetterNode } from "../nodes/review.node";
import type { LetterEditModel } from "../tools/generate-edit.tool";

/** Produces only a proposal. Existing Prisma proposal/decision controls all writes. */
export function createLetterEditGraph(scope: ExecutionScope, model?: LetterEditModel) {
  return new StateGraph(LetterEditState)
    .addNode("plan", tracedNode(scope, "cover-letter.plan", planLetterNode))
    .addNode("generate", tracedNode(scope, "cover-letter.generate", createGenerateLetterNode(scope, model)))
    .addNode("verify", tracedNode(scope, "cover-letter.verify", verifyLetterNode))
    .addNode("review", tracedNode(scope, "cover-letter.review", reviewLetterNode))
    .addEdge(START, "plan")
    .addConditionalEdges("plan", (state: typeof LetterEditState.State) => state.plan?.mode === "clarification" ? "review" : "generate")
    .addEdge("generate", "verify")
    .addEdge("verify", "review")
    .addEdge("review", END)
    .compile();
}
