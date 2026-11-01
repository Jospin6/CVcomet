import type { UnifiedJob } from "@/lib/find-jobs/types";
import type { EditorResume } from "@/lib/resume-editor";
import type { MatchResult } from "@/lib/career/job-schema";

export type DiscoveryPool = { jobs: UnifiedJob[]; warnings: string[] };
/** Injection seam for offline contract tests; production uses existing providers
 * and the step-10 Job Match Agent, not a second matching implementation. */
export type JobDiscoveryDependencies = Readonly<{
  discover?: (signal: AbortSignal) => Promise<DiscoveryPool>;
  authorizeDeepMatch?: (signal: AbortSignal) => Promise<void>;
  match?: (job: UnifiedJob, resume: EditorResume, language: "fr" | "en", signal: AbortSignal) => Promise<MatchResult>;
}>;
