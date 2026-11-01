import prisma from "../../../../../../prisma/prisma";
import { getCareerQualityOverview } from "@/lib/quality/agent-observations";
import type { CountRow, EvaluationEvidence } from "./contracts.tool";

const STATUS_KEYS = new Set(["RUNNING", "COMPLETED", "FAILED"]);
const PROGRESS_KEYS = new Set([
  "mission.started", "mission.completed", "mission.failed", "step.started", "step.completed",
  "step.failed", "tool.started", "tool.completed", "tool.failed", "approval.required",
]);
function groupRows(rows: readonly { _count: { _all: number } }[], field: "status" | "kind"): CountRow[] {
  const accepted = field === "status" ? STATUS_KEYS : PROGRESS_KEYS;
  return rows.map(row => ({ key: String((row as unknown as Record<string, unknown>)[field]), count: row._count._all }))
    .filter(row => accepted.has(row.key));
}
/** Server-only read. Restrict data to aggregate technical counters; no record-level identifiers. */
export async function readStage19Evaluation(from: Date, until: Date): Promise<EvaluationEvidence> {
  const where = { createdAt: { gte: from, lte: until } };
  const [career, runs, progress, expiredRunningLeases, usage] = await Promise.all([
    getCareerQualityOverview(until),
    prisma.careerMissionRun.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.careerMissionProgressEvent.groupBy({ by: ["kind"], where, _count: { _all: true } }),
    prisma.careerMissionRun.count({ where: { ...where, status: "RUNNING", leaseUntil: { lt: until } } }),
    prisma.aIUsage.aggregate({ where, _count: { _all: true, estimatedCost: true },
      _sum: { estimatedCost: true, inputTokens: true, outputTokens: true } }),
  ]);
  const trackedCalls = usage._count._all;
  const pricedCalls = usage._count.estimatedCost;
  return {
    career,
    runStatuses: groupRows(runs, "status"), progressEvents: groupRows(progress, "kind"), expiredRunningLeases,
    aiUsage: {
      trackedCalls, pricedCalls,
      inputTokens: trackedCalls > 0 ? usage._sum.inputTokens : null,
      outputTokens: trackedCalls > 0 ? usage._sum.outputTokens : null,
      estimatedUSD: trackedCalls > 0 && pricedCalls === trackedCalls && usage._sum.estimatedCost !== null
        ? usage._sum.estimatedCost.toString() : null,
    },
  };
}
