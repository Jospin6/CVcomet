import type { CountRow, EvaluationEvidence, EvaluationOverview } from "./contracts.tool";

const SAFE_ERRORS = new Set([
  "AGENT_EMPTY_ANSWER", "AGENT_UNSUPPORTED_ACTION_CLAIM", "AGENT_PLAN_REJECTED",
  "AGENT_TIME_BUDGET_EXCEEDED", "INVALID_AGENT_MESSAGE", "UNAUTHORIZED",
  "AI_QUOTA_EXCEEDED", "RATE_LIMITED", "AGENT_FAILED",
]);
const integer = (n: unknown) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : 0;
function total(rows: readonly CountRow[], key: string): number {
  return rows.filter(r => r.key === key).reduce((sum, row) => sum + integer(row.count), 0);
}
const percent = (num: number, den: number) => den > 0 ? Math.round(1000 * num / den) / 10 : null;
/** Every metric has an explicit denominator; unknown values remain null. */
export function assembleEvaluation(evidence: EvaluationEvidence): Omit<EvaluationOverview, "gates" | "decision"> {
  const runStatuses = evidence.runStatuses;
  const completed = total(runStatuses, "COMPLETED");
  const failed = total(runStatuses, "FAILED");
  const running = total(runStatuses, "RUNNING");
  const calls = integer(evidence.aiUsage.trackedCalls);
  const priced = Math.min(calls, integer(evidence.aiUsage.pricedCalls));
  const coverage = calls === 0 ? "no_data" : priced === calls ? "complete_recorded_only" : "incomplete";
  return {
    scope: "agentic_operational_partial",
    window: { from: evidence.career.from, until: evidence.career.until },
    careerAssistant: { ...evidence.career,
      errors: evidence.career.errors.map(row => ({
        code: SAFE_ERRORS.has(row.code) ? row.code : "AGENT_FAILED", count: integer(row.count),
      })),
    },
    missions: {
      completed, failed, running,
      expiredLeases: integer(evidence.expiredRunningLeases),
      terminalCompletionPercent: percent(completed, completed + failed),
      progressEventCounts: evidence.progressEvents.map(row => ({ key: row.key, count: integer(row.count) })),
      toolEventCounts: {
        started: total(evidence.progressEvents, "tool.started"),
        completed: total(evidence.progressEvents, "tool.completed"),
        failed: total(evidence.progressEvents, "tool.failed"),
      },
    },
    aiUsage: {
      scope: "all_recorded_ai_features", trackedCalls: calls, pricedCalls: priced,
      inputTokens: evidence.aiUsage.inputTokens, outputTokens: evidence.aiUsage.outputTokens,
      estimatedUSD: coverage === "complete_recorded_only" &&
        typeof evidence.aiUsage.estimatedUSD === "string" && /^\d{1,12}(\.\d{1,6})?$/.test(evidence.aiUsage.estimatedUSD)
        ? evidence.aiUsage.estimatedUSD : null,
      coverage,
    },
    limitations: [
      "Career Assistant observations do not cover all specialized agents or provider failures.",
      "Progress events concern recorded mission attempts; they can be missing if telemetry failed.",
      "Tool event counts are not per-tool reliability or permission-leak measurements.",
      "AI usage is platform-wide for recorded calls only; estimates are not invoices or actual agent-specific costs.",
      "Factual grounding, access-control effectiveness, approval integrity and recovery require independent reviewed tests.",
      "No candidate content, employer outcomes, model answers, actor identifiers or tool payloads are returned.",
    ],
  };
}
