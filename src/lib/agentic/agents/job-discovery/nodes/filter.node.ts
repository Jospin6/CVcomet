import type { JobDiscoveryState } from "../agent/state";
import { strictDiscoveryFilter } from "../tools/filter.tool";
export function filterJobsNode(state: typeof JobDiscoveryState.State) {
  return strictDiscoveryFilter(state.pool.jobs, state.input.preferences);
}
