import { END, START, StateGraph } from "@langchain/langgraph";
import { tracedNode } from "../../../core/nodes/traced-node.ts";
import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { ReadToolRegistry } from "../../../core/tools/read-tool-registry.ts";
import { normalizeNode } from "../nodes/normalize.node.ts";
import { inspectNode } from "../nodes/inspect.node.ts";
import { renderNode } from "../nodes/render.node.ts";
import { registerDemoTools } from "../tools/count-words.tool.ts";
import { DemoState } from "./state.ts";

/** Real LangGraph compilation; no API, DB, LLM, auth bypass or write. */
export function createDemoGraph(scope: ExecutionScope) {
  const registry = new ReadToolRegistry();
  registerDemoTools(registry);
  return new StateGraph(DemoState)
    .addNode("normalize", tracedNode(scope, "normalize", normalizeNode))
    .addNode("inspect", tracedNode(scope, "inspect", (state: typeof DemoState.State) => inspectNode(state, scope, registry)))
    .addNode("render", tracedNode(scope, "render", renderNode))
    .addEdge(START, "normalize")
    .addEdge("normalize", "inspect")
    .addEdge("inspect", "render")
    .addEdge("render", END)
    .compile();
}
