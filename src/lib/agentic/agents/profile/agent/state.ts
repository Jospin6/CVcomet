import { Annotation } from "@langchain/langgraph";
import type { CareerProfile, ProfileData } from "@/lib/career-profile/schema";
import type { extractionSchema } from "@/lib/career-profile/extraction";
import type { ProfileImportReview } from "@/lib/career-profile/merge";
import type { z } from "zod";

export type ExtractedProfile = z.infer<typeof extractionSchema>;

/** Ephemeral only: no checkpointer. Do NOT serialize documents or profile PII to a durable graph state. */
export const ProfileAgentState = Annotation.Root({
  current: Annotation<CareerProfile>,
  extracted: Annotation<ExtractedProfile>,
  proposal: Annotation<ProfileData>,
  review: Annotation<ProfileImportReview>,
  readyForReview: Annotation<boolean>,
  unverifiedFields: Annotation<string[]>,
  evidenceMode: Annotation<"text_verified" | "native_pdf_review">,
});
