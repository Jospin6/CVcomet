import { Annotation } from "@langchain/langgraph";
import type { EditorResume } from "@/lib/resume-editor";
import type { z } from "zod";
import { coverLetterSchema } from "@/helpers/schema";
import type { careerProfileContext } from "@/lib/career-profile/service";

export type LetterCreationInput = Readonly<{
  job: { title: string; company: string; description: string };
  profile: { name: string; email: string; phone: string; address: string; headline: string };
  confirmedProfile: ReturnType<typeof careerProfileContext>;
  resume?: EditorResume;
  notes: string;
  localization: string;
  documentLanguage: "fr" | "en" | "de";
  facts: string;
  technicalRequirements: string[];
}>;
export type CoverLetterDraft = z.infer<typeof coverLetterSchema>["coverLetter"];
export type CreationPlan = Readonly<{ ready: boolean; reason?: string }>;
export const LetterCreationState = Annotation.Root({
  input: Annotation<LetterCreationInput>,
  plan: Annotation<CreationPlan>,
  draft: Annotation<CoverLetterDraft>,
  verified: Annotation<CoverLetterDraft>,
  issue: Annotation<"UNSUPPORTED_FACTS">,
  readyForReview: Annotation<boolean>,
});
