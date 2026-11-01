import { Annotation } from "@langchain/langgraph";
import type { LanguageModel } from "ai";
import type { EditorResume } from "@/lib/resume-editor";
import type { JobAnalysis } from "@/lib/career/job-schema";
import type { AtsAnalysis, AtsJobMatch, PdfAudit, SemanticReview } from "@/lib/career/ats-types";

/** Ephemeral state: may contain CV text and an AI model instance.
 * NEVER compile this workflow with a checkpointer or persist the state. */
export type AtsAgentInput = Readonly<{
  resume: EditorResume;
  keywords?: string[];
  language?: "fr" | "en";
  document?: PdfAudit;
  jobDescription?: string;
  jobAnalysis?: unknown;
}>;

export type AtsPlan = Readonly<{
  visible: EditorResume;
  jobMode: "none" | "saved" | "extract";
  savedAnalysis: JobAnalysis | null;
}>;

export const AtsAgentState = Annotation.Root({
  input: Annotation<AtsAgentInput>,
  plan: Annotation<AtsPlan>,
  model: Annotation<LanguageModel | null>,
  modelError: Annotation<string | null>,
  semantic: Annotation<SemanticReview>,
  jobMatch: Annotation<AtsJobMatch>,
  report: Annotation<AtsAnalysis>,
  verified: Annotation<boolean>,
});
