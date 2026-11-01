import { randomUUID } from "node:crypto";
import { AgenticError } from "../../../core/errors.ts";
import { runAgentGraph } from "../../../core/execution/runner.ts";
import { CareerContractError } from "@/lib/career-os/contracts";
import { ApplicationPacketState, ApplicationSuggestionState } from "./state";
import { createApplicationPacketGraph, createApplicationSuggestionGraph } from "./graph";
import { assertPacketInput, assertSuggestionInput } from "../tools/validation.tool";
import type { ApplicationPacketInput, ApplicationSuggestionInput, ApplicationSuggestionDependencies } from "../tools/contracts.tool";

function identity(actorId: string) {
  if (!actorId?.trim()) throw new CareerContractError(401, "UNAUTHORIZED");
  return { runId: randomUUID(), agentId: "application", access: { kind: "authenticated" as const, actorId } };
}

/** Read-only graph: DB ownership + idempotent create are handled by the calling service. */
export async function runApplicationPacketAgent(options: { actorId: string; input: ApplicationPacketInput; signal?: AbortSignal }) {
  const runIdentity = identity(options.actorId);
  assertPacketInput(options.input);
  const state = await runAgentGraph<Partial<typeof ApplicationPacketState.State>, typeof ApplicationPacketState.State>({
    identity: runIdentity, input: { input: options.input }, createGraph: createApplicationPacketGraph,
    timeoutMs: 8_000, recursionLimit: 10, signal: options.signal,
  });
  if (!state.verified || !state.result) throw new AgenticError("AGENT_RUN_FAILED", 502);
  return state.result;
}

/** The result is a preview only. Never persists, sends or submits anything. */
export async function runApplicationSuggestionAgent(options: {
  actorId: string; input: ApplicationSuggestionInput; deps: ApplicationSuggestionDependencies; signal?: AbortSignal;
}) {
  const runIdentity = identity(options.actorId);
  assertSuggestionInput(options.input);
  const state = await runAgentGraph<Partial<typeof ApplicationSuggestionState.State>, typeof ApplicationSuggestionState.State>({
    identity: runIdentity, input: { input: options.input },
    createGraph: scope => createApplicationSuggestionGraph(scope, options.deps),
    timeoutMs: 50_000, recursionLimit: 10, signal: options.signal,
  });
  if (!state.verified || !state.result) throw new CareerContractError(422, "SUGGESTION_REQUIRES_REVIEW");
  return state.result;
}
