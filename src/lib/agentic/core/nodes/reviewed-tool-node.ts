import { interrupt } from "@langchain/langgraph";
import type { AgentToolContext } from "../tools/agent-tool-registry.ts";
import { AgentToolRegistry } from "../tools/agent-tool-registry.ts";
import { executeReviewedTool } from "../tools/reviewed-execution.ts";

/** LangGraph HITL boundary. interrupt must not be wrapped in try/catch. */
export async function runReviewedWriteNode(options: {
  registry: AgentToolRegistry;
  name: string;
  input: unknown;
  context: AgentToolContext;
}): Promise<unknown> {
  return executeReviewedTool({ ...options, review: interrupt });
}
