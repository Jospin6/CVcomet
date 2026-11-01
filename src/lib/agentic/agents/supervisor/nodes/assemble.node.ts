import type { SupervisorState } from "../agent/state";
import { CareerContractError } from "@/lib/career-os/contracts";

export function supervisorAssembleNode(state: typeof SupervisorState.State) {
  if (!state.verified || !state.answer) throw new CareerContractError(502, "AGENT_FAILED");
  return { result: {
    message: state.answer, steps: state.steps, specialist: state.plan.specialist,
    mode: "read_only" as const, requiresApproval: false as const,
  } };
}
