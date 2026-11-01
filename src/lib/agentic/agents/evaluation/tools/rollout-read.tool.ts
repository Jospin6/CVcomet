/** Admin-only caller: server-side grouped metadata, no candidate-level rows returned. */
import prisma from "../../../../../../prisma/prisma";
import { percentile } from "@/lib/quality/agent-quality-policy";
import { safeCareerRolloutConfig } from "@/lib/agentic/core/policies/career-rollout";
import { compareCareerRollout, type EngineSample } from "./rollout-compare.tool";

export async function readCareerRolloutComparison(now = new Date()) {
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const where = { createdAt: { gte: from, lte: now } };
  const [groups, graphTimes, legacyTimes] = await Promise.all([
    prisma.careerAgentObservation.groupBy({ by: ["engine", "outcome"], where,
      _count: { _all: true } }),
    prisma.careerAgentObservation.findMany({ where: { ...where, engine: "GRAPH", outcome: "COMPLETED" },
      select: { durationMs: true }, orderBy: { createdAt: "desc" }, take: 1000 }),
    prisma.careerAgentObservation.findMany({ where: { ...where, engine: "LEGACY", outcome: "COMPLETED" },
      select: { durationMs: true }, orderBy: { createdAt: "desc" }, take: 1000 }),
  ]);
  const count = (engine: string, outcome: string) => groups
    .filter(r => r.engine === engine && r.outcome === outcome).reduce((n, r) => n + r._count._all, 0);
  const samples: EngineSample[] = (["GRAPH", "LEGACY"] as const).map(engine => {
    const values = (engine === "GRAPH" ? graphTimes : legacyTimes).map(r => r.durationMs);
    return { engine, completed: count(engine, "COMPLETED"), failed: count(engine, "FAILED"),
      p95Ms: percentile(values, 95), sampledCompleted: values.length };
  });
  return compareCareerRollout(samples, count("UNKNOWN", "COMPLETED") + count("UNKNOWN", "FAILED"),
    safeCareerRolloutConfig(process.env), from, now);
}
