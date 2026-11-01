import type { ExecutionScope } from "../../../core/execution/runner.ts";
import type { JobDiscoveryState } from "../agent/state";
import type { JobDiscoveryDependencies } from "../tools/contracts.tool";
import { retrieveRealJobs, trustedJobPool } from "../tools/discover.tool";
export function createDiscoverJobsNode(deps: JobDiscoveryDependencies, scope: ExecutionScope) {
  return async (_state: typeof JobDiscoveryState.State) => {
    const pool = await (deps.discover ?? retrieveRealJobs)(scope.budget.signal);
    return { pool: trustedJobPool(pool) };
  };
}
