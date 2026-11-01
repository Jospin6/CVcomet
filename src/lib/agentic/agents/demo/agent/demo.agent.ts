import type { AgentEventListener } from "../../../core/contracts.ts";
import { runAgentGraph } from "../../../core/execution/runner.ts";
import { createDemoGraph } from "./graph.ts";

/** Opt-in local smoke only; intentionally NOT connected to any production API. */
export function runDemoAgent(options: {
  runId: string;
  text: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  onEvent?: AgentEventListener;
}) {
  return runAgentGraph({
    identity: { runId: options.runId, agentId: "demo", access: { kind: "public_demo" } },
    input: { text: options.text },
    createGraph: createDemoGraph,
    timeoutMs: options.timeoutMs,
    signal: options.signal,
    onEvent: options.onEvent,
  });
}
