import type { AgentEventListener, AgentRunIdentity, InvocableAgentGraph, AgentInvokeConfig } from "../contracts.ts";
import { AgenticError, normalizeAgenticError } from "../errors.ts";
import { createEventEmitter } from "../events.ts";
import { assertRunIdentity } from "../policies/identity.ts";
import { createRunBudget, type RunBudget } from "./budget.ts";

export type ExecutionScope = Readonly<{
  identity: AgentRunIdentity;
  budget: RunBudget;
  step: <T>(name: string, work: () => Promise<T> | T) => Promise<T>;
}>;

export async function runAgentGraph<TInput, TOutput>(options: {
  identity: AgentRunIdentity;
  input: TInput;
  createGraph: (scope: ExecutionScope) => InvocableAgentGraph<TInput, TOutput>;
  signal?: AbortSignal;
  timeoutMs?: number;
  recursionLimit?: number;
  /** Generated inside the trusted server boundary; never from client JSON. */
  configurable?: AgentInvokeConfig["configurable"];
  onEvent?: AgentEventListener;
}): Promise<TOutput> {
  assertRunIdentity(options.identity);
  const recursionLimit = options.recursionLimit ?? 16;
  if (!Number.isSafeInteger(recursionLimit) || recursionLimit < 2 || recursionLimit > 64) {
    throw new AgenticError("AGENT_INVALID_BUDGET", 400);
  }
  const emit = createEventEmitter(options.identity, options.onEvent);
  const budget = createRunBudget({ signal: options.signal, timeoutMs: options.timeoutMs });
  const scope: ExecutionScope = {
    identity: options.identity,
    budget,
    async step(name, work) {
      budget.assertActive();
      if (!/^[a-z][a-z0-9_.-]{0,63}$/.test(name)) {
        throw new AgenticError("AGENT_STEP_FAILED", 400);
      }
      emit("step.started", name);
      try {
        const result = await budget.guard(work);
        emit("step.completed", name);
        return result;
      } catch (error) {
        const safe = normalizeAgenticError(error);
        emit("step.failed", name, safe.code);
        throw safe;
      }
    },
  };
  emit("run.started");
  try {
    budget.assertActive();
    const graph = options.createGraph(scope);
    const result = await budget.guard(() => graph.invoke(options.input, {
      signal: budget.signal,
      recursionLimit,
      ...(options.configurable ? { configurable: options.configurable } : {}),
    }));
    budget.assertActive();
    // A LangGraph interrupt returns __interrupt__, which is PAUSED, not completed.
    const paused = typeof result === "object" && result !== null &&
      "__interrupt__" in result && Array.isArray(result.__interrupt__) &&
      result.__interrupt__.length > 0;
    emit(paused ? "run.paused" : "run.completed");
    return result;
  } catch (error) {
    const safe = normalizeAgenticError(error);
    emit(safe.code === "AGENT_CANCELLED" ? "run.cancelled" : "run.failed", undefined, safe.code);
    throw safe;
  } finally {
    budget.close();
  }
}
