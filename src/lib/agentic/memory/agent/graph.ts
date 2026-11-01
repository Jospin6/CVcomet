import { START, END, StateGraph } from "@langchain/langgraph";
import { tracedNode } from "../../core/nodes/traced-node";
import type { ExecutionScope } from "../../core/execution/runner";
import { MemoryState } from "./state";
import { memoryContextNode } from "../nodes/context.node";
import { memoryVerifyNode } from "../nodes/verify.node";
import type { AgentMemorySnapshot } from "../tools/assemble.tool";
import type { MemoryAgent } from "../tools/policy.tool";

export function createCareerMemoryGraph(scope: ExecutionScope, load: (actorId: string, agentId: MemoryAgent, missionId?: string) => Promise<AgentMemorySnapshot>) {
  return new StateGraph(MemoryState)
    .addNode("context", tracedNode(scope, "memory.context", memoryContextNode))
    .addNode("read", tracedNode(scope, "memory.read", async (state: typeof MemoryState.State) => {
      scope.budget.assertActive();
      const snapshot = await load(state.actorId, state.agentId, state.missionId);
      scope.budget.assertActive();
      return { snapshot };
    }))
    .addNode("verify", tracedNode(scope, "memory.verify", memoryVerifyNode))
    .addEdge(START, "context")
    .addEdge("context", "read")
    .addEdge("read", "verify")
    .addEdge("verify", END)
    .compile();
}
