import { START, END, StateGraph } from "@langchain/langgraph";
import { tracedNode } from "../../../core/nodes/traced-node.ts";
import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { EvaluationState } from "./state";
import { evaluationContextNode } from "../nodes/context.node";
import { evaluationMeasureNode } from "../nodes/measure.node";
import { evaluationGateNode } from "../nodes/gate.node";
import { evaluationVerifyNode } from "../nodes/verify.node";
import type { EvaluationDependencies } from "../tools/contracts.tool";

export function createEvaluationGraph(scope: ExecutionScope, deps: EvaluationDependencies) {
  return new StateGraph(EvaluationState)
    .addNode("context", tracedNode(scope, "evaluation.context", evaluationContextNode))
    .addNode("read", tracedNode(scope, "evaluation.read", async (state: typeof EvaluationState.State) => {
      scope.budget.assertActive();
      const evidence = await deps.read(state.from, state.until);
      scope.budget.assertActive();
      return { evidence };
    }))
    .addNode("measure", tracedNode(scope, "evaluation.measure", evaluationMeasureNode))
    .addNode("gate", tracedNode(scope, "evaluation.gate", evaluationGateNode))
    .addNode("verify", tracedNode(scope, "evaluation.verify", evaluationVerifyNode))
    .addEdge(START, "context")
    .addEdge("context", "read")
    .addEdge("read", "measure")
    .addEdge("measure", "gate")
    .addEdge("gate", "verify")
    .addEdge("verify", END)
    .compile();
}
