import { rankJobs, type CandidatePreferences } from "@/lib/find-jobs/ranking";
import type { UnifiedJob } from "@/lib/find-jobs/types";

export const DISCOVERY_RESULTS_LIMIT = 5;
export const DEEP_MATCH_LIMIT = 3;

/** Heuristic only selects ads; its number is NEVER returned as a verified score. */
export function shortlistRelevantJobs(jobs: UnifiedJob[], candidate: CandidatePreferences): UnifiedJob[] {
  const ranked = rankJobs(jobs, candidate);
  // The previous domain-only cutoff discarded relevant career pivots and
  // imported CVs whose skills are demonstrated in projects rather than titles.
  // Keep a credible evidence overlap, but never show this heuristic as a %.
  return ranked.filter(item => item.match.relevant ||
    (item.match.matched.length >= 2 && item.match.score >= 25))
    .slice(0, DISCOVERY_RESULTS_LIMIT)
    .map(({ match: _heuristic, ...job }) => job);
}
