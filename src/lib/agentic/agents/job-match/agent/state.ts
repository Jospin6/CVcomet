import { Annotation } from "@langchain/langgraph";
import type { CareerProfile, ProfileData } from "@/lib/career-profile/schema";
import type { EditorResume } from "@/lib/resume-editor";
import type { JobAnalysis, MatchResult, ResumePreparationAction } from "@/lib/career/job-schema";

/** Ephemeral, authenticated workflow: never checkpoint profile/CV/posting text. */
export type JobMatchAgentInput = Readonly<{
  description: string;
  language: "fr" | "en";
  profile: CareerProfile | ProfileData;
  resume?: EditorResume;
  savedAnalysis?: unknown;
}>;

export const JobMatchAgentState = Annotation.Root({
  input: Annotation<JobMatchAgentInput>,
  saved: Annotation<JobAnalysis | null>,
  analysis: Annotation<JobAnalysis>,
  match: Annotation<MatchResult>,
  resumePlan: Annotation<ResumePreparationAction[]>,
  verified: Annotation<boolean>,
  result: Annotation<{ analysis: JobAnalysis; match: MatchResult }>,
});
