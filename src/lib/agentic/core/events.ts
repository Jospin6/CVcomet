import type { AgentEvent, AgentEventKind, AgentEventListener, AgentRunIdentity } from "./contracts.ts";

/** Telemetry is non-critical; observers must never change agent outcomes. */
export function createEventEmitter(identity: AgentRunIdentity, listener?: AgentEventListener) {
  return (kind: AgentEventKind, step?: string, code?: string): void => {
    if (!listener) return;
    const event: AgentEvent = {
      kind,
      runId: identity.runId,
      agentId: identity.agentId,
      at: new Date().toISOString(),
      ...(step ? { step } : {}),
      ...(code ? { code } : {}),
    };
    try { listener(event); } catch { /* safe, best-effort metrics */ }
  };
}
