import { randomUUID } from "node:crypto";

/** Do not log candidate PII, prompts, CV contents, tokens or provider errors. */
export type CareerTrace = Readonly<{ requestId: string; operation: string; startedAt: number }>;
const safeName = (name: string) => /^[a-z][a-z0-9_.-]{1,63}$/.test(name) ? name : "invalid_operation";

export function startCareerTrace(operation: string): CareerTrace {
  return { requestId: randomUUID(), operation: safeName(operation), startedAt: Date.now() };
}

export function finishCareerTrace(trace: CareerTrace, status: "ok" | "error", errorCode?: string): void {
  const durationMs = Math.max(0, Date.now() - trace.startedAt);
  const code = errorCode && /^[A-Z][A-Z0-9_]{1,63}$/.test(errorCode) ? errorCode : "INTERNAL_ERROR";
  console.info("career_os_operation", {
    requestId: trace.requestId, operation: trace.operation, status, durationMs,
    ...(status === "error" ? { errorCode: code } : {}),
  });
}
