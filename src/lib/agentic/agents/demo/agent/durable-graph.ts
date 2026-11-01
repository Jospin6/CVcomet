import { END, START, StateGraph } from "@langchain/langgraph";
import type { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { tracedNode } from "../../../core/nodes/traced-node.ts";
import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { askDemoApproval } from "../nodes/ask-approval.node.ts";
import { DurableDemoState } from "./durable-state.ts";

export function createDurableDemoGraph(scope: ExecutionScope, checkpointer: PostgresSaver) {
  return new StateGraph(DurableDemoState)
    // Interrupting nodes must not run inside scope.step(): it normalizes GraphInterrupt.
    .addNode("review", askDemoApproval)
    .addNode("finish", tracedNode(scope, "finish", (state: typeof DurableDemoState.State) => ({
      result: state.confirmed ? "approved" : "rejected",
    })))
    .addEdge(START, "review")
    .addEdge("review", "finish")
    .addEdge("finish", END)
    .compile({ checkpointer });
}
