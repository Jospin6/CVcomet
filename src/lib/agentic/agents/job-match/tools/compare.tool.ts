import { matchJob } from "@/lib/career/job-match";
import { buildJobIntelligence } from "@/lib/career/job-intelligence";
import type { JobAnalysis, MatchResult } from "@/lib/career/job-schema";
import type { JobMatchAgentInput } from "../agent/state";

/** Score remains entirely deterministic and owned by the existing business
 * scorer. Language changes explanations only, never the numbers. */
export function compareCandidateToJob(input: JobMatchAgentInput, analysis: JobAnalysis): MatchResult {
  const match = matchJob(input.profile, analysis, input.resume);
  return { ...match, intelligence: buildJobIntelligence(analysis, match, input.language) };
}
