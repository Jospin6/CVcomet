import { Annotation } from "@langchain/langgraph";
import type { EditorResume } from "@/lib/resume-editor";
import type { ResumeConversationResult, ResumeConversationEdit } from "@/lib/resume-conversation";

/** Ephemeral state ONLY. Never compile this graph with a checkpointer: it contains
 * unredacted CV text. The persistent, reviewable artifact is ResumeAIProposal. */
export type ResumeAgentInput = Readonly<{
  document: EditorResume;
  instruction: string;
  language: "fr" | "en";
  profileFacts: unknown;
  linkedJobAdvert: unknown;
  selectedField?: string;
  targetField?: string;
  history?: ReadonlyArray<{ role: "user" | "assistant"; content: string }>;
}>;

export type ResumeAgentPlan = Readonly<{
  mode: "general" | "focused" | "tailor" | "clarification";
  targetField?: string;
  message?: string;
}>;

export type ResumeAgentDraft = Readonly<{
  object: ResumeConversationResult;
  document: EditorResume | null;
}>;

export type ResumeAgentResult = Readonly<{
  object: ResumeConversationResult;
  document: EditorResume | null;
}>;

export const ResumeAgentState = Annotation.Root({
  input: Annotation<ResumeAgentInput>,
  plan: Annotation<ResumeAgentPlan>,
  draft: Annotation<ResumeAgentDraft>,
  result: Annotation<ResumeAgentResult>,
  readyForReview: Annotation<boolean>,
});

export type ResumeAgentEdits = ReadonlyArray<ResumeConversationEdit>;
