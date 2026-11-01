import type { JobDiscoveryState } from "../agent/state";
import { candidateFromResume } from "../tools/context.tool";
export function contextJobDiscoveryNode(state: typeof JobDiscoveryState.State) {
  return { candidate: candidateFromResume(state.input.resume, state.input.preferences) };
}
