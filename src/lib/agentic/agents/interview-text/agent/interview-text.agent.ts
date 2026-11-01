import { randomUUID } from "node:crypto";
import { AgenticError } from "../../../core/errors.ts";
import { runAgentGraph } from "../../../core/execution/runner.ts";
import { InterviewPreparationState, InterviewEvaluationState } from "./state";
import { createInterviewPreparationGraph, createInterviewEvaluationGraph } from "./graph";
import { assertEvaluationInput, assertPreparationInput } from "../tools/validation.tool";
import type { InterviewTextDependencies, InterviewPreparationInput, InterviewEvaluationInput } from "../tools/contracts.tool";

function identity(actorId: string) {
  if (!actorId?.trim()) throw new AgenticError("AGENT_INVALID_IDENTITY", 401);
  return { runId: randomUUID(), agentId: "interview-text", access: { kind: "authenticated" as const, actorId } };
}

/** The service must resolve CV/application ownership BEFORE calling this agent. */
export async function runInterviewPreparationAgent(options: {
  actorId: string;
  input: InterviewPreparationInput;
  deps: InterviewTextDependencies;
  signal?: AbortSignal;
}) {
  const runIdentity = identity(options.actorId);
  assertPreparationInput(options.input);
  const state = await runAgentGraph<Partial<typeof InterviewPreparationState.State>, typeof InterviewPreparationState.State>({
    identity: runIdentity,
    input: { input: options.input },
    createGraph: scope => createInterviewPreparationGraph(scope, options.deps),
    timeoutMs: 48_000, recursionLimit: 12, signal: options.signal,
  });
  if (!state.verified || !state.result) throw new AgenticError("AGENT_RUN_FAILED", 502);
  return state.result;
}

export async function runInterviewEvaluationAgent(options: {
  actorId: string;
  input: InterviewEvaluationInput;
  deps: InterviewTextDependencies;
  signal?: AbortSignal;
}) {
  const runIdentity = identity(options.actorId);
  assertEvaluationInput(options.input);
  const state = await runAgentGraph<Partial<typeof InterviewEvaluationState.State>, typeof InterviewEvaluationState.State>({
    identity: runIdentity,
    input: { input: options.input },
    createGraph: scope => createInterviewEvaluationGraph(scope, options.deps),
    timeoutMs: 26_000, recursionLimit: 12, signal: options.signal,
  });
  if (!state.verified || !state.result) throw new AgenticError("AGENT_RUN_FAILED", 502);
  return state.result;
}
