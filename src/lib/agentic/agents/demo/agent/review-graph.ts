import { END, START, StateGraph } from "@langchain/langgraph";
import type { MemorySaver } from "@langchain/langgraph";
import type { AgentRunIdentity } from "../../../core/contracts.ts";
import { runReviewedWriteNode } from "../../../core/nodes/reviewed-tool-node.ts";
import { createReviewDemoRegistry } from "../tools/review-demo.tool.ts";
import { ReviewDemoState } from "./review-state.ts";

/** Synthetic end-to-end test graph. No real customer records or external actions. */
export function createReviewDemoGraph(options: {
  identity: AgentRunIdentity;
  missionId: string;
  checkpointer: MemorySaver;
  getRevision: () => string;
  record: (idempotencyKey: string) => void;
}) {
  const registry = createReviewDemoRegistry(options);
  return new StateGraph(ReviewDemoState)
    // Never wrap an interrupting node with scope.step()/tracedNode: that catches
    // LangGraph's GraphInterrupt and destroys suspension semantics.
    .addNode("review", async (state: typeof ReviewDemoState.State) => ({
      result: await runReviewedWriteNode({
        registry, name: "demo_update",
        input: { resourceId: state.resourceId, revision: state.revision },
        context: { identity: options.identity, missionId: options.missionId,
          signal: new AbortController().signal },
      }) as string,
    }))
    .addEdge(START, "review")
    .addEdge("review", END)
    .compile({ checkpointer: options.checkpointer });
}
