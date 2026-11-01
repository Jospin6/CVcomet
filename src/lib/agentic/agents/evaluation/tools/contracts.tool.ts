/** Operational evidence only. No candidates, prompts, documents, conversations or tool payloads. */
export type CountRow = Readonly<{ key: string; count: number }>;
export type CareerOverview = Readonly<{
  scope: string; from: string; until: string;
  total: number; completed: number; failed: number; observedSuccessRate: number | null;
  latencyMs: { p50: number | null; p95: number | null; sampledCompleted: number; totalCompleted: number; sampleCap: number };
  errors: readonly { code: string; count: number }[];
  feedback: { helpful: number; notHelpful: number; total: number; positiveShare: number | null; note: string };
  excluded: readonly string[]; note: string;
}>;
export type EvaluationEvidence = Readonly<{
  career: CareerOverview;
  runStatuses: readonly CountRow[];
  progressEvents: readonly CountRow[];
  expiredRunningLeases: number;
  aiUsage: Readonly<{
    trackedCalls: number; pricedCalls: number; inputTokens: number | null;
    outputTokens: number | null; estimatedUSD: string | null;
  }>;
}>;
export type GateStatus = "PASS" | "FAIL" | "INSUFFICIENT_DATA" | "NOT_MEASURED";
export type QualityGate = Readonly<{
  key: string; status: GateStatus; observed: number | null; threshold: number | null; explanation: string;
}>;
export type EvaluationOverview = Readonly<{
  scope: "agentic_operational_partial";
  window: { from: string; until: string };
  careerAssistant: CareerOverview;
  missions: {
    completed: number; failed: number; running: number; expiredLeases: number;
    terminalCompletionPercent: number | null;
    progressEventCounts: readonly CountRow[];
    toolEventCounts: { started: number; completed: number; failed: number };
  };
  aiUsage: {
    scope: "all_recorded_ai_features"; trackedCalls: number; pricedCalls: number;
    inputTokens: number | null; outputTokens: number | null;
    estimatedUSD: string | null; coverage: "complete_recorded_only" | "incomplete" | "no_data";
  };
  gates: readonly QualityGate[];
  decision: "BLOCKED" | "REQUIRES_REVIEW";
  limitations: readonly string[];
}>;
export type EvaluationDependencies = Readonly<{
  read: (from: Date, until: Date) => Promise<EvaluationEvidence>;
}>;
