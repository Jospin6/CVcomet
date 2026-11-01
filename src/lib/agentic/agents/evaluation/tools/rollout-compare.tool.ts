/** Privacy-safe, purely operational comparison. Never implies answer correctness. */
export type EngineName = "GRAPH" | "LEGACY";
export type EngineSample = Readonly<{
  engine: EngineName; completed: number; failed: number; p95Ms: number | null;
  sampledCompleted: number;
}>;
export type EngineRow = EngineSample & Readonly<{
  total: number; completionPercent: number | null;
  sampleAdequate: boolean;
}>;
export type RolloutComparison = Readonly<{
  scope: "career_assistant_rollout_only";
  window: { from: string; until: string };
  engines: readonly EngineRow[];
  unattributedHistorical: number;
  config: { mode: string; percent: number | null; killSwitch: boolean; effectiveMode: string };
  decision: "BLOCKED" | "REQUIRES_REVIEW" | "INSUFFICIENT_DATA";
  warnings: readonly string[];
}>;

const safeCount = (v: number) => Number.isSafeInteger(v) && v >= 0 ? v : 0;

export function compareCareerRollout(samples: readonly EngineSample[], unknownCount: number,
  config: RolloutComparison["config"], from: Date, until: Date): RolloutComparison {
  const engines: EngineRow[] = (["LEGACY", "GRAPH"] as const).map(engine => {
    const item = samples.find(s => s.engine === engine);
    const completed = safeCount(item?.completed ?? 0);
    const failed = safeCount(item?.failed ?? 0);
    const total = completed + failed;
    const sampledCompleted = Math.min(completed, safeCount(item?.sampledCompleted ?? 0));
    const p95Ms = item?.p95Ms != null && Number.isFinite(item.p95Ms) && item.p95Ms >= 0 ? item.p95Ms : null;
    return { engine, completed, failed, total, sampledCompleted, p95Ms,
      completionPercent: total ? Math.round(completed / total * 1000) / 10 : null,
      sampleAdequate: total >= 30 && sampledCompleted >= 30 };
  });
  const legacy = engines[0], graph = engines[1];
  const sufficient = legacy.sampleAdequate && graph.sampleAdequate;
  // Use simple *operational* guardrails; never run automatic deployment actions.
  const degraded = sufficient && (
    graph.completionPercent! < legacy.completionPercent! - 5 ||
    graph.p95Ms === null || graph.p95Ms > 55_000
  );
  return {
    scope: "career_assistant_rollout_only", window: { from: from.toISOString(), until: until.toISOString() },
    engines, unattributedHistorical: safeCount(unknownCount), config,
    decision: !sufficient ? "INSUFFICIENT_DATA" : degraded ? "BLOCKED" : "REQUIRES_REVIEW",
    warnings: [
      "Observed operational counts only; model factual accuracy and user outcomes are not measured.",
      "Cohorts may differ in traffic mix. Comparison is not a controlled causal experiment.",
      "p95 is sampled from the latest 1000 completed calls per engine, not all requests.",
      "UNKNOWN historical observations are excluded from the comparison.",
      "Provider errors, quotas and telemetry gaps can bias completion rates; review before rollout.",
      "Human security review, real-model evaluation and production build remain mandatory.",
    ],
  };
}
