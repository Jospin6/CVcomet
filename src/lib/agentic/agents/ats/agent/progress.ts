import type { AtsAgentState } from "./state";

/** Only exists for one run in memory, never persisted or logged. It allows
 * resuming the deterministic pipeline without repeating paid model calls. */
export type AtsExecutionProgress = {
  started: Set<string>;
  values: Partial<typeof AtsAgentState.State>;
};
