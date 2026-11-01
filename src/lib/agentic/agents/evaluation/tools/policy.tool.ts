import type { EvaluationOverview, QualityGate } from "./contracts.tool";

/** Conservative predefined *operational* staging thresholds; never AI accuracy claims. */
export const STAGE19_GATES = Object.freeze({ minCases: 30, completionPercent: 95, p95Ms: 55_000 });
const gate = (key: string, status: QualityGate["status"], observed: number | null, threshold: number | null, explanation: string): QualityGate =>
  ({ key, status, observed, threshold, explanation });

export function evaluateStage19Gates(view: Omit<EvaluationOverview, "gates" | "decision">): Pick<EvaluationOverview, "gates" | "decision"> {
  const n = view.careerAssistant.total;
  const terminalRuns = view.missions.completed + view.missions.failed;
  const gates: QualityGate[] = [
    gate("career_assistant_completion", n < STAGE19_GATES.minCases ? "INSUFFICIENT_DATA"
      : (view.careerAssistant.observedSuccessRate ?? 0) >= STAGE19_GATES.completionPercent ? "PASS" : "FAIL",
      view.careerAssistant.observedSuccessRate, STAGE19_GATES.completionPercent,
      "Recorded Career Assistant completion only, not correctness."),
    gate("career_assistant_p95_latency", view.careerAssistant.latencyMs.sampledCompleted < STAGE19_GATES.minCases ? "INSUFFICIENT_DATA"
      : view.careerAssistant.latencyMs.p95 !== null && view.careerAssistant.latencyMs.p95 <= STAGE19_GATES.p95Ms ? "PASS" : "FAIL",
      view.careerAssistant.latencyMs.p95, STAGE19_GATES.p95Ms,
      "p95 of latest completed sampled requests; no claim about missing requests."),
    gate("mission_terminal_completion", terminalRuns < STAGE19_GATES.minCases ? "INSUFFICIENT_DATA"
      : (view.missions.terminalCompletionPercent ?? 0) >= STAGE19_GATES.completionPercent ? "PASS" : "FAIL",
      view.missions.terminalCompletionPercent, STAGE19_GATES.completionPercent,
      "Recorded terminal mission attempts; running attempts are excluded."),
    gate("expired_running_leases", view.missions.expiredLeases > 0 ? "FAIL" : "PASS",
      view.missions.expiredLeases, 0, "Unreconciled expired mission leases in the selected window."),
    gate("recorded_ai_cost_coverage", view.aiUsage.coverage === "no_data" ? "INSUFFICIENT_DATA"
      : view.aiUsage.coverage === "complete_recorded_only" ? "PASS" : "FAIL",
      view.aiUsage.trackedCalls === 0 ? null : Math.round(view.aiUsage.pricedCalls / view.aiUsage.trackedCalls * 1000) / 10,
      100, "Tariff coverage of *recorded* AI usage; vendor billing still requires reconciliation."),
    gate("cross_user_access_and_unapproved_actions", "NOT_MEASURED", null, 0,
      "Zero tolerated; run negative authorization and action-approval fixtures, plus staging penetration tests."),
    gate("groundedness_and_hiring_claims", "NOT_MEASURED", null, null,
      "Human-labeled multilingual benchmark and real-model evaluation required."),
    gate("model_provider_recovery", "NOT_MEASURED", null, null,
      "Failure-injection and real Neon/LiveKit/provider recovery tests required."),
  ];
  return { gates, decision: gates.some(g => g.status === "FAIL") ? "BLOCKED" : "REQUIRES_REVIEW" };
}
