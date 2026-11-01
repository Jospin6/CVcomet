import { CareerContractError } from "@/lib/career-os/contracts";
import type { ApplicationPacketState, ApplicationSuggestionState } from "../agent/state";

export function applicationPacketAssembleNode(state: typeof ApplicationPacketState.State) {
  if (!state.verified) throw new CareerContractError(422, "SUGGESTION_REQUIRES_REVIEW");
  return { result: state.draft };
}
export function applicationSuggestionAssembleNode(state: typeof ApplicationSuggestionState.State) {
  return { result: state.verified ? state.draft : null };
}
