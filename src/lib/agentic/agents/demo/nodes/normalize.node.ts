import type { DemoState } from "../agent/state.ts";
import { AgenticError } from "../../../core/errors.ts";

/** No LLM and no side effect: validates and normalizes a short demo phrase. */
export function normalizeNode(state: typeof DemoState.State) {
  if (typeof state.text !== "string" || state.text.length > 120 || !state.text.trim()) {
    throw new AgenticError("AGENT_TOOL_INPUT_INVALID", 400);
  }
  return { normalized: state.text.trim().replace(/\s+/g, " ") };
}
