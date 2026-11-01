import { AgenticError } from "../../../core/errors.ts";
import type { EvaluationState } from "../agent/state";

export function evaluationContextNode(state: typeof EvaluationState.State) {
  const from = state.from, until = state.until;
  if (!(from instanceof Date) || !(until instanceof Date) || !Number.isFinite(from.getTime()) ||
      !Number.isFinite(until.getTime()) || from.getTime() >= until.getTime() ||
      until.getTime() - from.getTime() !== 7 * 24 * 60 * 60_000) {
    throw new AgenticError("AGENT_MODEL_INPUT_INVALID", 400);
  }
  return {};
}
