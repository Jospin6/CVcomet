import { Annotation } from "@langchain/langgraph";
import type { EditorResume } from "@/lib/resume-editor";
import type { MatchingPreferences } from "@/lib/find-jobs/for-you";
import type { UnifiedJob } from "@/lib/find-jobs/types";
import type { CountryFacet } from "@/lib/find-jobs/facets";
import type { CandidatePreferences } from "@/lib/find-jobs/ranking";

export type JobDiscoveryInput = Readonly<{
  resume: EditorResume;
  preferences: MatchingPreferences;
  language: "en" | "fr";
}>;
export type DiscoveryMatch = Readonly<{
  score: number | null;
  matched: string[];
  missing: string[];
  explanation: string;
}>;
export type DiscoveryJob = Omit<UnifiedJob, "match"> & { match: DiscoveryMatch };
export type JobDiscoveryResult = Readonly<{
  jobs: DiscoveryJob[];
  countries: CountryFacet[];
  totalConsidered: number;
  matchingStatus: "empty" | "verified" | "partial" | "unavailable";
  verifiedCount: number;
  deepMatchCount: number;
  warnings: string[];
  warningCode: string | null;
  reason?: "NO_MATCHING_OFFERS";
}>;
export const JobDiscoveryState = Annotation.Root({
  input: Annotation<JobDiscoveryInput>,
  candidate: Annotation<CandidatePreferences>,
  pool: Annotation<{ jobs: UnifiedJob[]; warnings: string[] }>,
  filtered: Annotation<UnifiedJob[]>,
  countries: Annotation<CountryFacet[]>,
  shortlist: Annotation<UnifiedJob[]>,
  checked: Annotation<DiscoveryJob[]>,
  warningCode: Annotation<string | null>,
  verifiedCount: Annotation<number>,
  deepMatchCount: Annotation<number>,
  result: Annotation<JobDiscoveryResult>,
});
