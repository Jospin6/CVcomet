import { analyzeJobDescription, validateJobAnalysis } from "@/lib/career/job-match";
import type { JobAnalysis } from "@/lib/career/job-schema";
import { AgenticError } from "../../../core/errors.ts";

/** Injected analyzer is only for integration testing; production uses existing
 * configured provider + source-grounded extractor. */
export type JobMatchDependencies = Readonly<{
  analyze?: (description: string, language: "fr" | "en", signal: AbortSignal) => Promise<JobAnalysis>;
}>;
export async function extractJobRequirements(description: string, language: "fr" | "en", signal: AbortSignal, deps: JobMatchDependencies = {}): Promise<JobAnalysis> {
  if (signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
  const analysis = deps.analyze
    ? await deps.analyze(description, language, signal)
    : await analyzeJobDescription(description, undefined, language, undefined, signal);
  if (signal.aborted) throw new AgenticError("AGENT_CANCELLED", 499);
  return validateJobAnalysis(analysis, description);
}
