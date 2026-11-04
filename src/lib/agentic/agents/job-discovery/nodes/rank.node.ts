import type { JobDiscoveryState } from "../agent/state";
import { shortlistRelevantJobs } from "../tools/rank.tool";

/** Resume evidence determines relevance; preferences first narrow the results.
 * If over-restrictive filters remove everything, suggest genuinely related
 * postings separately without pretending they satisfy those filters. */
export function rankJobsNode(state: typeof JobDiscoveryState.State) {
  const preferred = shortlistRelevantJobs(state.filtered, state.candidate);
  if (preferred.length) {
    return { shortlist: preferred, outsideFilters: false };
  }
  const resumeRelated = shortlistRelevantJobs(state.pool.jobs, state.candidate);
  return { shortlist: resumeRelated, outsideFilters: resumeRelated.length > 0 };
}
