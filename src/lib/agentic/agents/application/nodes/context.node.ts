import type { ApplicationPacketState, ApplicationSuggestionState } from "../agent/state";
import { assertPacketInput, assertSuggestionInput } from "../tools/validation.tool";

export function applicationPacketContextNode(state: typeof ApplicationPacketState.State) {
  assertPacketInput(state.input);
  return { verified: false };
}
export function applicationSuggestionContextNode(state: typeof ApplicationSuggestionState.State) {
  assertSuggestionInput(state.input);
  return { draft: null, verified: false };
}
