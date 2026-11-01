import type {
  AgentEventListener, AgentRunIdentity, AgentInvokeConfig, InvocableAgentGraph,
} from "../contracts.ts";
import { AgenticError } from "../errors.ts";
import { makeMissionThread, type DurableMission } from "../persistence/thread.ts";
import { runAgentGraph, type ExecutionScope } from "./runner.ts";

/** Minimal interface exposed by LangGraph's CompiledStateGraph. */
export type CheckpointedGraph<TInput, TOutput> = InvocableAgentGraph<TInput, TOutput> & {
  getState(config: AgentInvokeConfig): Promise<{
    tasks?: readonly { interrupts?: readonly unknown[] }[];
    next?: readonly string[];
  }>;
};

/** Injectable boundary supports tests without a live database or LLM. */
export type DurableStore<TSaver> = Readonly<{
  checkpointer: TSaver;
  withThreadLock: <T>(threadId: string, work: () => Promise<T>) => Promise<T>;
}>;

type Start<TInput> = Readonly<{ kind: "start"; input: TInput }>;
/** Only server code may construct resumeInput (typically LangGraph's Command). */
type Resume<TInput> = Readonly<{ kind: "resume"; resumeInput: TInput }>;
/** Retry a failed/incomplete step from its checkpoint; NEVER bypass an interrupt. */
type Retry<TInput> = Readonly<{ kind: "retry"; retryInput: TInput }>;

export type DurableRunResult<TOutput> = Readonly<{
  status: "paused" | "completed";
  output: TOutput;
}>;

/** Detect a genuine LangGraph HITL interrupt; do not confuse an ordinary failure with approval. */
export function hasPendingInterrupt(snapshot: { tasks?: readonly { interrupts?: readonly unknown[] }[] }): boolean {
  return snapshot.tasks?.some((task) => (task.interrupts?.length ?? 0) > 0) ?? false;
}

export function canRetryAfterFailure(snapshot: {
  tasks?: readonly { interrupts?: readonly unknown[] }[];
  next?: readonly string[];
}): boolean {
  return !hasPendingInterrupt(snapshot) && (snapshot.next?.length ?? 0) > 0;
}

export function isGraphPaused(output: unknown): boolean {
  return typeof output === "object" && output !== null &&
    "__interrupt__" in output && Array.isArray(output.__interrupt__) &&
    output.__interrupt__.length > 0;
}

/**
 * Durable mission protocol:
 * - tenant-bound stable thread ID (independent from run attempt ID)
 * - cross-process advisory lock from PostgreSQL
 * - reject starting an existing thread (idempotency guard)
 * - resume only if a LangGraph interrupt is actually pending
 * - all checkpoints persisted by LangGraph before invoke resolves
 *
 * This code does not grant approval: all resume requests must be authenticated
 * and authorized at their future API boundary (stage 04).
 */
export async function runDurableAgentGraph<TInput, TOutput, TSaver>(options: {
  identity: AgentRunIdentity;
  missionId: string;
  mode: Start<TInput> | Resume<TInput> | Retry<TInput>;
  createGraph: (scope: ExecutionScope, saver: TSaver) => CheckpointedGraph<TInput, TOutput>;
  store: DurableStore<TSaver>;
  signal?: AbortSignal;
  timeoutMs?: number;
  recursionLimit?: number;
  onEvent?: AgentEventListener;
}): Promise<DurableRunResult<TOutput>> {
  const mission: DurableMission = { identity: options.identity, missionId: options.missionId };
  const thread = makeMissionThread(mission);

  return options.store.withThreadLock(thread.configurable.thread_id, async () => {
    // Does NOT read or reveal state values to the caller.
    const saver = options.store.checkpointer as unknown as {
      getTuple: (config: AgentInvokeConfig) => Promise<unknown>;
    };
    let stored: unknown;
    try {
      stored = await saver.getTuple(thread);
    } catch {
      throw new AgenticError("AGENT_CHECKPOINT_UNAVAILABLE", 503);
    }
    if (options.mode.kind === "start" && stored) {
      throw new AgenticError("AGENT_THREAD_ALREADY_EXISTS", 409);
    }
    if (options.mode.kind !== "start" && !stored) {
      throw new AgenticError("AGENT_THREAD_NOT_FOUND", 404);
    }

    const output = await runAgentGraph<TInput, TOutput>({
      identity: options.identity,
      input: options.mode.kind === "start" ? options.mode.input :
        options.mode.kind === "resume" ? options.mode.resumeInput : options.mode.retryInput,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
      recursionLimit: options.recursionLimit,
      onEvent: options.onEvent,
      configurable: thread.configurable,
      createGraph: (scope) => {
        const graph = options.createGraph(scope, options.store.checkpointer);
        if (options.mode.kind === "start") return graph;
        return {
          invoke: async (input, config) => {
            const snapshot = await graph.getState(config ?? thread);
            if (options.mode.kind === "resume" && !hasPendingInterrupt(snapshot)) {
              throw new AgenticError("AGENT_THREAD_NOT_INTERRUPTED", 409);
            }
            if (options.mode.kind === "retry" && !canRetryAfterFailure(snapshot)) {
              throw new AgenticError("AGENT_THREAD_NOT_RETRYABLE", 409);
            }
            return graph.invoke(input, config);
          },
        };
      },
    });
    return { status: isGraphPaused(output) ? "paused" : "completed", output };
  });
}

/** Read-only existence check: checkpoint contents never leave the core. */
export async function durableMissionExists<TSaver extends { getTuple: (config: AgentInvokeConfig) => Promise<unknown> }>(
  mission: DurableMission,
  store: DurableStore<TSaver>,
): Promise<boolean> {
  const thread = makeMissionThread(mission);
  try {
    return Boolean(await store.checkpointer.getTuple(thread));
  } catch {
    throw new AgenticError("AGENT_CHECKPOINT_UNAVAILABLE", 503);
  }
}

/** Privacy lifecycle: call this after the owner deletes a mission. */
export async function deleteDurableMission<TSaver extends { deleteThread: (threadId: string) => Promise<void> }>(
  mission: DurableMission,
  store: DurableStore<TSaver>,
): Promise<void> {
  const thread = makeMissionThread(mission);
  await store.withThreadLock(thread.configurable.thread_id, async () => {
    try {
      await store.checkpointer.deleteThread(thread.configurable.thread_id);
    } catch {
      throw new AgenticError("AGENT_CHECKPOINT_UNAVAILABLE", 503);
    }
  });
}
