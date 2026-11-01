import type { LetterCreationState } from "../agent/creation-state";
import { verifyLetterCreation } from "../tools/verify-creation.tool";
import { ProfileError } from "@/lib/career-profile/http";
export function verifyCreationNode(state: typeof LetterCreationState.State) {
  if (!state.input || !state.draft) throw new Error("LETTER_CREATION_DRAFT_REQUIRED");
  try {
    return { verified: verifyLetterCreation(state.input, state.draft) };
  } catch (error) {
    // A missing fact is a review/clarification issue, not a provider outage.
    if (error instanceof ProfileError && error.code === "UNSUPPORTED_FACTS") {
      return { issue: "UNSUPPORTED_FACTS" as const };
    }
    throw error;
  }
}
