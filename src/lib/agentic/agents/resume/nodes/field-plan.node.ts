import { AgenticError } from "../../../core/errors.ts";
import type { ResumeFieldState } from "../agent/field-state";

export function planResumeFieldNode(state: typeof ResumeFieldState.State) {
  if (!state.input) throw new AgenticError("AGENT_MODEL_INPUT_INVALID", 400);
  const input = state.input;
  if (!input.field.trim() || input.field.length > 120 ||
      !Array.isArray(input.candidateSources) || input.candidateSources.length > 150 ||
      typeof input.systemPolicy !== "string" || input.systemPolicy.length > 5000) {
    throw new AgenticError("AGENT_MODEL_INPUT_INVALID", 400);
  }
  const prompt = JSON.stringify({ action: input.action, selectedField: input.field,
    language: input.language, candidateFacts: input.facts });
  if (prompt.length > 59_000) throw new AgenticError("AGENT_MODEL_INPUT_INVALID", 413);
  return { prompt };
}
