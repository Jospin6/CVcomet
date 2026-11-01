import { Annotation } from "@langchain/langgraph";
import type { CoverLetterDocument } from "@/lib/cover-letter-editor";

export type LetterFact = Readonly<{ statement: string; id?: string; revision?: number }>;
export type LetterTarget = Readonly<{ title: string; company: string; description: string }>;
/** In-memory only: personal letter content MUST NOT be placed into a checkpointer. */
export type LetterEditInput = Readonly<{
  document: CoverLetterDocument;
  instruction: string;
  language: "fr" | "en";
  targetField?: "introduction" | "body" | "conclusion";
  history?: ReadonlyArray<{ role: "user" | "assistant"; content: string }>;
  profileFacts: readonly LetterFact[];
  requirements: readonly string[];
  jobTarget: LetterTarget | null;
}>;
export type LetterEditDraft = Readonly<{
  message: string;
  changes: string[];
  document: CoverLetterDocument;
}>;
export type LetterEditResult = Readonly<{
  status: "proposal" | "clarification";
  message: string;
  changes: string[];
  document: CoverLetterDocument | null;
}>;
export type LetterEditPlan = Readonly<{
  mode: "general" | "focused" | "clarification";
  message?: string;
}>;
export const LetterEditState = Annotation.Root({
  input: Annotation<LetterEditInput>,
  plan: Annotation<LetterEditPlan>,
  draft: Annotation<LetterEditDraft>,
  result: Annotation<LetterEditResult>,
  readyForReview: Annotation<boolean>,
});
