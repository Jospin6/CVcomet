import { rankJobs, type CandidatePreferences } from "@/lib/find-jobs/ranking";
import type { UnifiedJob } from "@/lib/find-jobs/types";

export const DISCOVERY_RESULTS_LIMIT = 5;
export const DEEP_MATCH_LIMIT = 3;

/** Heuristic only selects ads; its number is NEVER returned as a verified score. */
export function shortlistRelevantJobs(jobs: UnifiedJob[], candidate: CandidatePreferences): UnifiedJob[] {
  const ranked = rankJobs(jobs, candidate);
  return ranked.filter(item => item.match.relevant).slice(0, DISCOVERY_RESULTS_LIMIT)
    .map(({ match: _heuristic, ...job }) => job);
}
