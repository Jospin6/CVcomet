import { matchesPreferences } from "@/lib/find-jobs/for-you";
import { jobCountryFacets } from "@/lib/find-jobs/facets";
import type { UnifiedJob } from "@/lib/find-jobs/types";
import type { MatchingPreferences } from "@/lib/find-jobs/for-you";

export function strictDiscoveryFilter(jobs: UnifiedJob[], preferences: MatchingPreferences, now = Date.now()) {
  return {
    countries: jobCountryFacets(jobs),
    // A desired role is a search intent: lexical variations are ranked below,
    // not discarded because their complete titles are not identical.
    // Geography, time, contract, level, work mode, salary and visa remain strict.
    filtered: jobs.filter(job => matchesPreferences(job, { ...preferences, title: "" }, now)),
  };
}
