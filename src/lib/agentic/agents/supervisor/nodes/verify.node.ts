import type { SupervisorState } from "../agent/state";
import { CareerContractError } from "@/lib/career-os/contracts";
import { assertAgentAnswer } from "@/lib/career-os/agent-engine";
import { reviewCareerAgentAnswer } from "@/lib/quality/agent-quality-policy";

export function supervisorVerifyNode(state: typeof SupervisorState.State) {
  if (!state.plan || !Array.isArray(state.reads) || !Array.isArray(state.steps)) {
    throw new CareerContractError(502, "AGENT_FAILED");
  }
  return { answer: reviewCareerAgentAnswer(assertAgentAnswer(state.answer)), verified: true };
}
