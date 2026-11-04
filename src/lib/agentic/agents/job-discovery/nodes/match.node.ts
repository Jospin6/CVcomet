import type { ExecutionScope } from "../../../core/execution/runner.ts";
import { profileAIError } from "@/lib/career-profile/http";
import type { JobDiscoveryState, DiscoveryJob } from "../agent/state";
import type { JobDiscoveryDependencies } from "../tools/contracts.tool";
import { canAnalyzeVacancy, delegateToJobMatch, authorizeMatch, unresolvedDiscoveryMatch, verifiedDiscoveryMatch } from "../tools/match.tool";
import { DEEP_MATCH_LIMIT } from "../tools/rank.tool";

/** An AI failure never forges a score or prevents access to verified real jobs. */
export function createMatchJobsNode(deps: JobDiscoveryDependencies, scope: ExecutionScope) {
  return async (state: typeof JobDiscoveryState.State) => {
    const { language, resume } = state.input;
    const unresolved = state.shortlist.map(job => ({
      ...job,
      outsidePreferences: state.outsideFilters === true,
      match: unresolvedDiscoveryMatch(language),
    }));
    const eligible = state.shortlist.slice(0, DEEP_MATCH_LIMIT)
      .filter(canAnalyzeVacancy);
    if (!eligible.length) return { checked: unresolved, warningCode: null, verifiedCount: 0, deepMatchCount: 0 };
    try {
      await (deps.authorizeDeepMatch ?? ((signal: AbortSignal) => authorizeMatch(scope.identity.access.kind === "authenticated" ? scope.identity.access.actorId : "", signal)))(scope.budget.signal);
    } catch (error) {
      return { checked: unresolved, warningCode: profileAIError(error).code, verifiedCount: 0, deepMatchCount: 0 };
    }
    const matcher = deps.match ?? ((job: typeof eligible[number], cv: typeof resume, lang: "fr" | "en", signal: AbortSignal) => {
      if (scope.identity.access.kind !== "authenticated") throw new Error("NOT_AUTHENTICATED");
      return delegateToJobMatch(scope.identity.access.actorId, job, cv, lang, signal);
    });
    const settled = await Promise.allSettled(eligible.map(job => matcher(job, resume, language, scope.budget.signal)));
    const byId = new Map<string, DiscoveryJob["match"]>();
    let warningCode: string | null = null;
    settled.forEach((item, index) => {
      if (item.status === "fulfilled") {
        byId.set(eligible[index].id, verifiedDiscoveryMatch(item.value, language));
      } else {
        warningCode = profileAIError(item.reason).code;
      }
    });
    const checked: DiscoveryJob[] = unresolved.map(job => ({
      ...job, match: byId.get(job.id) ?? job.match,
    }));
    return {
      checked,
      warningCode,
      verifiedCount: checked.filter(job => job.match.score !== null).length,
      deepMatchCount: eligible.length,
    };
  };
}
