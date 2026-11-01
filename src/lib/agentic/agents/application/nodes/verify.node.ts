import type { ApplicationPacketState, ApplicationSuggestionState } from "../agent/state";
import type { ApplicationSuggestionDependencies } from "../tools/contracts.tool";
import { assertApplicationEmail, verifiedSuggestion } from "../tools/validation.tool";

export function applicationPacketVerifyNode(state: typeof ApplicationPacketState.State) {
  assertApplicationEmail(state.draft, "initial");
  return { verified: true };
}
export function createApplicationSuggestionVerifyNode(deps: ApplicationSuggestionDependencies) {
  return (state: typeof ApplicationSuggestionState.State) => {
    try {
      return { draft: verifiedSuggestion(state.draft, state.input, deps.verifyFacts), verified: true };
    } catch {
      // Invalid model output is never shown or applied.
      return { draft: null, verified: false };
    }
  };
}
