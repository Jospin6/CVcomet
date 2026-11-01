import { AgenticError } from "../../../core/errors.ts";
import { careerEvidence, matchJob, validateJobAnalysis } from "@/lib/career/job-match";
import type { JobAnalysis, MatchResult } from "@/lib/career/job-schema";
import type { JobMatchAgentInput } from "../agent/state";

const fail = () => { throw new AgenticError("AGENT_RUN_FAILED", 502); };
/** Fail-closed validation: no model-controlled scores, statuses, or candidate
 * quotations; evidence paths must exist in this actor's own profile/CV. */
export function verifyEvidenceMatch(input: JobMatchAgentInput, analysis: JobAnalysis, result: MatchResult) {
  const validated = validateJobAnalysis(analysis, input.description);
  const canonical = matchJob(input.profile, validated, input.resume);
  const scores = ["overallScore", "skillScore", "keywordScore", "experienceScore", "educationScore", "evaluatedCount", "unverifiedCount", "totalCount", "scoreExplanation", "source"] as const;
  for (const key of scores) if (result[key] !== canonical[key]) fail();
  if (JSON.stringify(result.components) !== JSON.stringify(canonical.components) ||
      JSON.stringify(result.requirements) !== JSON.stringify(canonical.requirements) ||
      result.version !== 1) fail();
  const authorized = new Map(careerEvidence(input.profile, input.resume).map(x => [x.path, x]));
  for (const requirement of result.requirements) {
    for (const evidence of requirement.evidenceSources) {
      const original = authorized.get(evidence.path);
      if (!original || original.quote !== evidence.quote || original.label !== evidence.label) fail();
    }
  }
  if (result.overallScore !== null && (result.overallScore < 0 || result.overallScore > 100)) fail();
}
