import type { SupervisorState } from "../agent/state";
import { assertSupervisorInput } from "../tools/routing.tool";

export function supervisorContextNode(state: typeof SupervisorState.State) {
  assertSupervisorInput(state.input);
  return { verified: false };
}
