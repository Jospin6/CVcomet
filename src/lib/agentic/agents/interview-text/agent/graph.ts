import { END, START, StateGraph } from "@langchain/langgraph";
import { tracedNode } from "../../../core/nodes/traced-node.ts";
import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { InterviewPreparationState, InterviewEvaluationState } from "./state";
import { preparationContextNode, evaluationContextNode } from "../nodes/context.node";
import { createPreparationGenerateNode, createEvaluationGenerateNode } from "../nodes/generate.node";
import { preparationVerifyNode, evaluationVerifyNode } from "../nodes/verify.node";
import { preparationAssembleNode, evaluationAssembleNode } from "../nodes/assemble.node";
import type { InterviewTextDependencies } from "../tools/contracts.tool";

/** Both interview text workflows are ephemeral, scoped and read-only. The caller alone persists messages. */
export function createInterviewPreparationGraph(scope: ExecutionScope, deps: InterviewTextDependencies) {
  return new StateGraph(InterviewPreparationState)
    .addNode("context", tracedNode(scope, "interview-text.prepare.context", preparationContextNode))
    .addNode("generate", tracedNode(scope, "interview-text.prepare.generate", createPreparationGenerateNode(scope, deps)))
    .addNode("verify", tracedNode(scope, "interview-text.prepare.verify", preparationVerifyNode))
    .addNode("assemble", tracedNode(scope, "interview-text.prepare.assemble", preparationAssembleNode))
    .addEdge(START, "context")
    .addEdge("context", "generate")
    .addEdge("generate", "verify")
    .addEdge("verify", "assemble")
    .addEdge("assemble", END)
    .compile();
}

export function createInterviewEvaluationGraph(scope: ExecutionScope, deps: InterviewTextDependencies) {
  return new StateGraph(InterviewEvaluationState)
    .addNode("context", tracedNode(scope, "interview-text.evaluate.context", evaluationContextNode))
    .addNode("generate", tracedNode(scope, "interview-text.evaluate.generate", createEvaluationGenerateNode(scope, deps)))
    .addNode("verify", tracedNode(scope, "interview-text.evaluate.verify", evaluationVerifyNode))
    .addNode("assemble", tracedNode(scope, "interview-text.evaluate.assemble", evaluationAssembleNode))
    .addEdge(START, "context")
    .addEdge("context", "generate")
    .addEdge("generate", "verify")
    .addEdge("verify", "assemble")
    .addEdge("assemble", END)
    .compile();
}
