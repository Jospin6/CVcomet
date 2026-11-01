import { AgenticError } from "../../../core/errors.ts";
import type { QualityGate } from "../tools/contracts.tool";
import type { EvaluationState } from "../agent/state";
export function evaluationVerifyNode(state: typeof EvaluationState.State) {
  if (!state.result || !state.result.gates?.length ||
    state.result.scope !== "agentic_operational_partial" ||
    !state.result.gates.some((g: QualityGate) => g.key === "cross_user_access_and_unapproved_actions" && g.status === "NOT_MEASURED")) {
    throw new AgenticError("AGENT_RUN_FAILED", 502);
  }
  return { verified: true };
}
