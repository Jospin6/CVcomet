import { AgenticError } from "../errors.ts";

export type RunBudget = Readonly<{
  signal: AbortSignal;
  assertActive: () => void;
  guard: <T>(work: () => Promise<T> | T) => Promise<T>;
  close: () => void;
}>;

/**
 * Local cancellation and deadline. This limits what the caller awaits; it does
 * not magically roll back side effects. Writes require separate idempotency and
 * explicit approval in later migration stages.
 */
export function createRunBudget(options: {
  signal?: AbortSignal;
  timeoutMs?: number;
} = {}): RunBudget {
  const timeoutMs = options.timeoutMs ?? 15_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) {
    throw new AgenticError("AGENT_INVALID_BUDGET", 400);
  }
  const controller = new AbortController();
  let reason: "cancelled" | "deadline" | null = null;
  let closed = false;
  const abort = (next: "cancelled" | "deadline") => {
    if (reason || closed) return;
    reason = next;
    controller.abort();
  };
  const externalAbort = () => abort("cancelled");
  options.signal?.addEventListener("abort", externalAbort, { once: true });
  if (options.signal?.aborted) externalAbort();
  const timer = setTimeout(() => abort("deadline"), timeoutMs);
  const fail = (): never => {
    throw new AgenticError(
      reason === "deadline" ? "AGENT_DEADLINE_EXCEEDED" : "AGENT_CANCELLED",
      reason === "deadline" ? 504 : 499,
    );
  };
  const assertActive = () => {
    if (controller.signal.aborted) fail();
  };
  return {
    signal: controller.signal,
    assertActive,
    async guard<T>(work: () => Promise<T> | T): Promise<T> {
      assertActive();
      return new Promise<T>((resolve, reject) => {
        let settled = false;
        const done = (finish: () => void) => {
          if (settled) return;
          settled = true;
          controller.signal.removeEventListener("abort", onAbort);
          finish();
        };
        const onAbort = () => done(() => {
          try { fail(); } catch (error) { reject(error); }
        });
        controller.signal.addEventListener("abort", onAbort, { once: true });
        if (controller.signal.aborted) { onAbort(); return; }
        Promise.resolve().then(work).then(
          (value) => done(() => resolve(value)),
          (error) => done(() => reject(error)),
        );
      });
    },
    close() {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", externalAbort);
    },
  };
}
