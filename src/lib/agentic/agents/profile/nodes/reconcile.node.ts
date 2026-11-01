import type { ProfileAgentState } from "../agent/state";
import { reconcileProfileTool } from "../tools/reconcile-profile.tool";

export function reconcileNode(state: typeof ProfileAgentState.State) {
  if (!state.current || !state.extracted) throw new Error("PROFILE_INPUT_MISSING");
  return reconcileProfileTool(state.current, state.extracted);
}
