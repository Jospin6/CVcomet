import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { profileAIError } from "@/lib/career-profile/http";
import type { JobDiscoveryState, DiscoveryJob, DiscoveryMatch } from "../agent/state";
import type { JobDiscoveryDependencies } from "../tools/contracts.tool";
import { canAnalyzeVacancy, delegateToJobMatch, authorizeMatch, unresolvedDiscoveryMatch, verifiedDiscoveryMatch } from "../tools/match.tool";
import { DEEP_MATCH_LIMIT } from "../tools/rank.tool";

// Stop adding new provider requests while an account limit or provider-wide
// outage is active. A per-offer validation error must not block other offers.
const STOP_ON = new Set([
  "AI_LIMIT", "AI_HOURLY_LIMIT", "AI_MONTHLY_LIMIT", "AI_RATE_LIMIT",
  "AI_AUTH_ERROR", "AI_MODEL_UNAVAILABLE", "AI_UNAVAILABLE",
  "AI_PROVIDER_UNAVAILABLE",
]);

/**
 * Every job is scored independently. One failure never invalidates a verified
 * score or prevents the user from opening a genuine sourced vacancy.
 * A retry reuses previous verified scores from the same server-side fingerprint;
 * only unverified eligible offers invoke the AI provider and reserve quota.
 */
export function createMatchJobsNode(deps: JobDiscoveryDependencies, scope: ExecutionScope) {
  return async (state: typeof JobDiscoveryState.State) => {
    const { language, resume } = state.input;
    const unresolved: DiscoveryJob[] = state.shortlist.map(job => ({
      ...job,
      outsidePreferences: state.outsideFilters === true,
      match: unresolvedDiscoveryMatch(language),
    }));
    const eligible = state.shortlist.slice(0, DEEP_MATCH_LIMIT).filter(canAnalyzeVacancy);
    const byId = new Map<string, DiscoveryMatch>();
    for (const job of eligible) {
      const previous = deps.previousVerifiedMatches?.get(job.id);
      // An external/unscored value must NEVER be used as a verified match.
      if (previous && Number.isInteger(previous.score) && previous.score !== null &&
          previous.score >= 0 && previous.score <= 100) {
        byId.set(job.id, previous);
      }
    }
    const checkedJobs = (warningCode: string | null) => {
      const checked: DiscoveryJob[] = unresolved.map(job => ({
        ...job, match: byId.get(job.id) ?? job.match,
      }));
      return {
        checked,
        warningCode,
        verifiedCount: eligible.filter(job => byId.has(job.id)).length,
        deepMatchCount: eligible.length,
      };
    };
    const pending = eligible.filter(job => !byId.has(job.id));
    if (pending.length === 0) return checkedJobs(null);

    try {
      await (deps.authorizeDeepMatch ?? ((signal: AbortSignal) => authorizeMatch(
        scope.identity.access.kind === "authenticated" ? scope.identity.access.actorId : "", signal,
      )))(scope.budget.signal);
    } catch (error) {
      const code = profileAIError(error).code;
      console.warn("Jobs for You evaluation authorization unavailable", { code });
      return checkedJobs(code);
    }
    const matcher = deps.match ?? ((job: typeof eligible[number], cv: typeof resume, lang: "fr" | "en", signal: AbortSignal) => {
      if (scope.identity.access.kind !== "authenticated") throw new Error("NOT_AUTHENTICATED");
      return delegateToJobMatch(scope.identity.access.actorId, job, cv, lang, signal);
    });

    let warningCode: string | null = null;
    let stop = false;
    let next = 0;
    // At most two concurrent model calls to reduce provider rate-limit spikes.
    // Every attempt is isolated. There is NO automatic paid second attempt.
    const worker = async () => {
      while (!stop && !scope.budget.signal.aborted) {
        const index = next++;
        if (index >= pending.length) return;
        const job = pending[index];
        try {
          const match = await matcher(job, resume, language, scope.budget.signal);
          const verified = verifiedDiscoveryMatch(match, language);
          if (verified.score === null) {
            // The Job Match Agent returned no checkable score. Do not invent one.
            warningCode ??= "AI_INVALID_RESPONSE";
            console.warn("Jobs for You evaluation did not produce a verified score", { position: index + 1 });
          } else {
            byId.set(job.id, verified);
          }
        } catch (error) {
          const code = profileAIError(error).code;
          warningCode ??= code;
          // Diagnostic contains no resume, job text, actor id or provider payload.
          console.warn("Jobs for You evaluation failed", { position: index + 1, code });
          if (STOP_ON.has(code)) stop = true;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(2, pending.length) }, worker));
    return checkedJobs(warningCode);
  };
}
