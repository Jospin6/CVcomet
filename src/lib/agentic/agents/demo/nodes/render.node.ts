import type { DemoState } from "../agent/state.ts";

export function renderNode(state: typeof DemoState.State) {
  return { result: `${state.normalized} (${state.wordCount} words)` };
}
