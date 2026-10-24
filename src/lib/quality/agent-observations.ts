import prisma from "../../../prisma/prisma";
import { percentile, sanitizeAgentObservation, type OperationalObservation } from "./agent-quality-policy";

/** Best-effort, privacy-minimized metadata. Failed telemetry must never block a candidate's reply.
 * User FK ensures account deletion cascades to operational events. */
export async function recordCareerAgentObservation(actorId: string, input: Partial<OperationalObservation>): Promise<void> {
  try {
    const event = sanitizeAgentObservation(input);
    await prisma.careerAgentObservation.create({ data: { userId: actorId, ...event } });
  } catch {
    // No provider error, actor identifier, model prompt or candidate content in logs.
    console.warn("career_agent_observation_unavailable");
  }
}

/** Operational scope: this observes only Career Agent requests; it is not global AI quality. */
export async function getCareerQualityOverview(now = new Date()) {
  const from = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const where = { createdAt: { gte: from, lte: now } };
  const [statuses, errors, sample, feedback] = await Promise.all([
    prisma.careerAgentObservation.groupBy({ by: ["outcome"], where, _count: { _all: true } }),
    prisma.careerAgentObservation.groupBy({ by: ["errorCode"], where: { ...where, outcome: "FAILED" }, _count: { _all: true } }),
    prisma.careerAgentObservation.findMany({ where: { ...where, outcome: "COMPLETED" },
      orderBy: { createdAt: "desc" }, take: 1000, select: { durationMs: true } }),
    prisma.careerMissionRun.groupBy({ by: ["feedbackRating"],
      where: { feedbackAt: { gte: from, lte: now }, feedbackRating: { not: null } },
      _count: { _all: true } }),
  ]);
  const successes = statuses.find(x => x.outcome === "COMPLETED")?._count._all ?? 0;
  const failures = statuses.find(x => x.outcome === "FAILED")?._count._all ?? 0;
  const count = successes + failures;
  const good = feedback.find(x => x.feedbackRating === "HELPFUL")?._count._all ?? 0;
  const bad = feedback.find(x => x.feedbackRating === "NOT_HELPFUL")?._count._all ?? 0;
  return {
    scope: "career_agent_only", from: from.toISOString(), until: now.toISOString(),
    total: count, completed: successes, failed: failures,
    observedSuccessRate: count ? Math.round(successes / count * 1000) / 10 : null,
    latencyMs: { p50: percentile(sample.map(r => r.durationMs), 50), p95: percentile(sample.map(r => r.durationMs), 95),
      sampledCompleted: sample.length, totalCompleted: successes, sampleCap: 1000 },
    errors: errors.filter(e => e.errorCode).map(e => ({ code: e.errorCode!, count: e._count._all })),
    feedback: { helpful: good, notHelpful: bad, total: good + bad,
      positiveShare: good + bad ? Math.round(good / (good + bad) * 1000) / 10 : null,
      note: "Self-selected mission feedback; not a representative accuracy or hiring success measure." },
    excluded: ["other_ai_workflows", "unrecorded_failures", "external_provider_invoices", "unrated_answers"],
    note: "Operational metrics only. No resume content, chat text, private tool results or external employer outcomes are included.",
  };
}
