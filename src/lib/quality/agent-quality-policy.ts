/** No source documents, chat content, credentials, or untrusted model text in quality metrics. */
import { CareerContractError } from "../career-os/contracts.ts";

export type AgentPhase = "PLAN" | "TOOLS" | "ANSWER";
export type AgentOutcome = "COMPLETED" | "FAILED";

const allowedErrors = new Set([
  "AGENT_EMPTY_ANSWER", "AGENT_UNSUPPORTED_ACTION_CLAIM", "AGENT_PLAN_REJECTED",
  "AGENT_TIME_BUDGET_EXCEEDED", "INVALID_AGENT_MESSAGE", "UNAUTHORIZED",
  "AI_QUOTA_EXCEEDED", "RATE_LIMITED", "AGENT_FAILED",
]);
export function safeAgentErrorCode(value: unknown): string {
  return typeof value === "string" && allowedErrors.has(value) ? value : "AGENT_FAILED";
}
export function boundedMetric(value: unknown, maximum: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? Math.min(value, maximum) : 0;
}

/** Conservative output gate, not a hallucination detector or a guarantee of factual accuracy.
 * Detect only unequivocal first-person claims of actions the agent cannot perform.
 * Legitimate quoted third-party statements must still be reviewed by the user. */
const unsupportedExternalClaims = [
  /\bI (?:have |'ve )?(?:already )?(?:sent|submitted|emailed) (?:your|the) (?:job application|application|resume|CV|cover letter)\b/i,
  /\bI (?:have |'ve )?(?:already )?(?:contacted|emailed) (?:the|your) (?:employer|recruiter)\b/i,
  /\bJ['’]ai (?:déjà )?(?:envoyé|soumis|déposé) (?:votre|ta|la) (?:candidature|lettre de motivation|CV)\b/i,
  /\bJ['’]ai (?:déjà )?(?:contacté|écrit à) (?:le|la|votre) (?:recruteur|employeur|entreprise)\b/i,
];
export function reviewCareerAgentAnswer(text: string): string {
  if (unsupportedExternalClaims.some(pattern => pattern.test(text))) {
    throw new CareerContractError(502, "AGENT_UNSUPPORTED_ACTION_CLAIM");
  }
  return text;
}

export type OperationalObservation = Readonly<{
  outcome: AgentOutcome; phase: AgentPhase; durationMs: number; toolCount: number; errorCode: string | null;
}>;
export function sanitizeAgentObservation(input: Partial<OperationalObservation>): OperationalObservation {
  const outcome: AgentOutcome = input.outcome === "COMPLETED" ? "COMPLETED" : "FAILED";
  return {
    outcome,
    phase: input.phase === "TOOLS" || input.phase === "ANSWER" ? input.phase : "PLAN",
    durationMs: boundedMetric(input.durationMs, 120000),
    toolCount: boundedMetric(input.toolCount, 3),
    errorCode: outcome === "FAILED" ? safeAgentErrorCode(input.errorCode) : null,
  };
}

export function percentile(values: readonly number[], percentileRank: number): number | null {
  const items = values.filter(n => Number.isFinite(n) && n >= 0).slice(0, 1000).sort((a, b) => a - b);
  if (!items.length) return null;
  if (!(percentileRank >= 0 && percentileRank <= 100)) return null;
  return items[Math.ceil(percentileRank / 100 * items.length) - 1 < 0 ? 0 : Math.ceil(percentileRank / 100 * items.length) - 1];
}
