import type { ProfileAgentState } from "../agent/state";
import { verifyExtractedEvidence } from "../tools/verify-evidence.tool";

export function createVerifyNode(sourceText: string) {
  return (state: typeof ProfileAgentState.State) => {
    if (!state.extracted) throw new Error("PROFILE_EXTRACTION_MISSING");
    const verified = verifyExtractedEvidence(state.extracted, sourceText);
    return {
      extracted: verified.verified,
      unverifiedFields: [...verified.unverifiedFields],
      evidenceMode: verified.evidenceMode,
    };
  };
}
