import { Command } from "@langchain/langgraph";
import type { AgentEventListener } from "../../../core/contracts.ts";
import { runDurableAgentGraph, type CheckpointedGraph } from "../../../core/execution/durable-runner.ts";
import { getPostgresPersistence } from "../../../core/persistence/postgres.ts";
import { createDurableDemoGraph } from "./durable-graph.ts";
import { DurableDemoState } from "./durable-state.ts";

/** Server-only smoke test. This is NOT an API route or a career agent. */
export async function runDurableDemo(options: {
  actorId: string;
  runId: string;
  missionId: string;
  mode: "start" | "resume";
  approved?: boolean;
  onEvent?: AgentEventListener;
}) {
  if (options.mode === "resume" && typeof options.approved !== "boolean") {
    throw new TypeError("Demo resume requires an explicit boolean decision");
  }
  const store = getPostgresPersistence();
  // The generic boundary also permits a Command as graph input on resume.
  type GraphInput = { request: string } | Command;
  return runDurableAgentGraph<GraphInput, typeof DurableDemoState.State, typeof store.checkpointer>({
    identity: { runId: options.runId, agentId: "demo", access: { kind: "authenticated", actorId: options.actorId } },
    missionId: options.missionId,
    mode: options.mode === "start"
      ? { kind: "start", input: { request: "read-only checkpoint demo" } }
      : { kind: "resume", resumeInput: new Command({ resume: options.approved }) },
    createGraph: (scope, saver) => createDurableDemoGraph(scope, saver) as unknown as CheckpointedGraph<GraphInput, typeof DurableDemoState.State>,
    store,
    onEvent: options.onEvent,
  });
}
