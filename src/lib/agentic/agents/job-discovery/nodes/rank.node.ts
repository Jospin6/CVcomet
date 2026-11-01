import type { JobDiscoveryState } from "../agent/state";
import { shortlistRelevantJobs } from "../tools/rank.tool";
export function rankJobsNode(state: typeof JobDiscoveryState.State) {
  return { shortlist: shortlistRelevantJobs(state.filtered, state.candidate) };
}
