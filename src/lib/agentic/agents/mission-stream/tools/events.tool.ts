/** Stage 18 events: allowlisted metadata only, safe to persist and display. */
export const PROGRESS_KINDS = [
  "mission.started", "step.started", "step.completed", "step.failed", "tool.started", "tool.completed",
  "tool.failed", "approval.required", "mission.completed", "mission.failed",
] as const;
export type CareerProgressKind = typeof PROGRESS_KINDS[number];
export type CareerProgress = Readonly<{ kind: CareerProgressKind; step?: string; code?: string }>;
const STEP_RE = /^[a-z][a-z0-9_.-]{0,79}$/;
const CODE_RE = /^[A-Z][A-Z0-9_]{0,59}$/;
export const MAX_PROGRESS_EVENTS_PER_ATTEMPT = 48;
export function safeProgress(value: CareerProgress): CareerProgress {
  if (!value || !PROGRESS_KINDS.includes(value.kind)) throw new Error("INVALID_PROGRESS_KIND");
  return {
    kind: value.kind,
    ...(typeof value.step === "string" && STEP_RE.test(value.step) ? { step: value.step } : {}),
    ...(typeof value.code === "string" && CODE_RE.test(value.code) ? { code: value.code } : {}),
  };
}

export function mapGraphProgress(event: { kind: string; step?: string; code?: string }): CareerProgress | null {
  switch (event.kind) {
    case "step.started": return safeProgress({ kind: "step.started", step: event.step });
    case "step.completed": return safeProgress({ kind: "step.completed", step: event.step });
    case "step.failed": return safeProgress({ kind: "step.failed", step: event.step, code: event.code ?? "AGENT_STEP_FAILED" });
    default: return null; // mission boundary emitted by owner-scoped mission service
  }
}
export function isTerminalProgress(kind: string): boolean {
  return kind === "mission.completed" || kind === "mission.failed";
}
