import { randomUUID } from "node:crypto";
import { runAgentGraph } from "../../../core/execution/runner.ts";
import { AgenticError } from "../../../core/errors.ts";
import { EvaluationState } from "./state";
import { createEvaluationGraph } from "./graph";
import type { EvaluationDependencies } from "../tools/contracts.tool";
import { readStage19Evaluation } from "../tools/read.tool";

/** The API must authenticate the ADMIN independently of the model before calling. */
export async function runEvaluationAgent(options: {
  adminId: string; now?: Date; deps?: EvaluationDependencies; signal?: AbortSignal;
}) {
  if (!options.adminId?.trim()) throw new AgenticError("AGENT_ACCESS_DENIED", 403);
  const until = options.now ?? new Date();
  const from = new Date(until.getTime() - 7 * 24 * 60 * 60_000);
  const state = await runAgentGraph<Partial<typeof EvaluationState.State>, typeof EvaluationState.State>({
    identity: { runId: randomUUID(), agentId: "evaluation", access: { kind: "authenticated", actorId: options.adminId } },
    input: { from, until },
    createGraph: scope => createEvaluationGraph(scope, options.deps ?? { read: readStage19Evaluation }),
    timeoutMs: 15_000, recursionLimit: 10, signal: options.signal,
  });
  if (!state.verified || !state.result) throw new AgenticError("AGENT_RUN_FAILED", 502);
  return state.result;
}
