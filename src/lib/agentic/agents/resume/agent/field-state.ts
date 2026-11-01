import { Annotation } from "@langchain/langgraph";

export type ResumeFieldInput = Readonly<{
  action: "GENERATE" | "IMPROVE" | "SHORTEN" | "PROFESSIONAL" | "GRAMMAR" | "ATS";
  field: string;
  language: "fr" | "en";
  systemPolicy: string;
  facts: unknown;
  candidateSources: string[];
}>;

/** Ephemeral generation context: never checkpoint user document text or PII. */
export const ResumeFieldState = Annotation.Root({
  input: Annotation<ResumeFieldInput>,
  prompt: Annotation<string>,
  draft: Annotation<string>,
  proposal: Annotation<string>,
  issue: Annotation<"AI_INVALID_RESPONSE" | "UNSUPPORTED_FACTS">,
  readyForReview: Annotation<boolean>,
});
