import { emptyProfile } from "@/lib/career-profile/schema";
import { getAIModel } from "@/lib/ai/model";
import { reserveProfileAI } from "@/lib/career-profile/ai";
import { runJobMatchAgent } from "@/lib/agentic/agents/job-match/agent/job-match.agent";
import { jobTextSchema, type MatchResult } from "@/lib/career/job-schema";
import type { UnifiedJob } from "@/lib/find-jobs/types";
import type { EditorResume } from "@/lib/resume-editor";
import type { DiscoveryMatch } from "../agent/state";

/** Quota is owned by the authenticated HTTP request. This adapter is invoked
 * exactly once per set of verified analyses, never for an empty pool. */
export async function authorizeMatch(userId: string, signal: AbortSignal) {
  if (signal.aborted) throw new Error("JOB_DISCOVERY_CANCELLED");
  await getAIModel({ structuredOutputs: true });
  if (signal.aborted) throw new Error("JOB_DISCOVERY_CANCELLED");
  await reserveProfileAI(userId, "JOB_ANALYSIS");
}

/** Step 10 owns the source-grounded requirement parsing and deterministic score. */
export async function delegateToJobMatch(
  actorId: string, job: UnifiedJob, resume: EditorResume,
  language: "fr" | "en", signal: AbortSignal,
): Promise<MatchResult> {
  return (await runJobMatchAgent({
    actorId,
    input: {
      description: job.description.slice(0, 50000), language,
      profile: emptyProfile("cv-only@example.com"), // Technical placeholder for schema; no profile evidence.
      resume,
    },
    signal,
  })).match;
}

export function verifiedDiscoveryMatch(match: MatchResult, language: "fr" | "en"): DiscoveryMatch {
  const score = match.overallScore;
  const valid = score !== null && Number.isInteger(score) && score >= 0 && score <= 100 &&
    match.version === 1 && match.source === "PROFILE_AND_RESUME";
  if (!valid) return unresolvedDiscoveryMatch(language);
  return {
    score,
    matched: match.requirements.filter(r => r.status === "DEMONSTRATED")
      .map(r => r.title).slice(0, 6),
    missing: match.requirements.filter(r => r.status === "NOT_DEMONSTRATED")
      .map(r => r.title).slice(0, 6),
    explanation: language === "fr"
      ? `${match.evaluatedCount} exigences évaluées sur le CV sélectionné. ${match.unverifiedCount} à vérifier.`
      : `${match.evaluatedCount} requirements checked against your selected resume. ${match.unverifiedCount} need verification.`,
  };
}
export function unresolvedDiscoveryMatch(language: "fr" | "en"): DiscoveryMatch {
  return {
    score: null, matched: [], missing: [],
    explanation: language === "fr" ? "Correspondance non vérifiée sur les preuves du CV."
      : "Match not yet verified against resume evidence.",
  };
}
export function canAnalyzeVacancy(job: UnifiedJob) {
  return jobTextSchema.safeParse(job.description.slice(0, 50000)).success;
}
