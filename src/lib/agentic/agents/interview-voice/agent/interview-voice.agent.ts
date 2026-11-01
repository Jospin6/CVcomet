import { randomUUID } from "node:crypto";
import { AgenticError } from "../../../core/errors.ts";
import { runAgentGraph } from "../../../core/execution/runner.ts";
import { VoicePreparationState, VoiceEvaluationState } from "./state";
import { createVoicePreparationGraph, createVoiceEvaluationGraph } from "./graph";
import { assertVoiceEvaluationInput, assertVoicePreparationInput } from "../tools/validation.tool";
import type { VoicePreparationInput, VoiceEvaluationInput, VoiceDependencies } from "../tools/contracts.tool";

function identity(actorId: string) {
  if (!actorId?.trim()) throw new AgenticError("AGENT_INVALID_IDENTITY", 401);
  return { runId: randomUUID(), agentId: "interview-voice", access: { kind: "authenticated" as const, actorId } };
}

export async function runVoicePreparationAgent(options: {
  actorId: string; input: VoicePreparationInput; signal?: AbortSignal;
}) {
  const runIdentity = identity(options.actorId);
  assertVoicePreparationInput(options.input);
  const state = await runAgentGraph<Partial<typeof VoicePreparationState.State>, typeof VoicePreparationState.State>({
    identity: runIdentity, input: { input: options.input },
    createGraph: createVoicePreparationGraph, timeoutMs: 8_000, recursionLimit: 10, signal: options.signal,
  });
  if (!state.verified || !state.result) throw new AgenticError("AGENT_RUN_FAILED", 502);
  return state.result;
}

export async function runVoiceEvaluationAgent(options: {
  actorId: string; input: VoiceEvaluationInput; deps: VoiceDependencies; signal?: AbortSignal;
}) {
  const runIdentity = identity(options.actorId);
  assertVoiceEvaluationInput(options.input);
  const state = await runAgentGraph<Partial<typeof VoiceEvaluationState.State>, typeof VoiceEvaluationState.State>({
    identity: runIdentity, input: { input: options.input },
    createGraph: scope => createVoiceEvaluationGraph(scope, options.deps),
    timeoutMs: 38_000, recursionLimit: 10, signal: options.signal,
  });
  if (!state.verified || !state.result) throw new AgenticError("AGENT_RUN_FAILED", 502);
  return state.result;
}
