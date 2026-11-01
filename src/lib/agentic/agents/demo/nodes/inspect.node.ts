import type { DemoState } from "../agent/state.ts";
import type { ExecutionScope } from "../../../core/execution/runner.ts";
import type { ReadToolRegistry } from "../../../core/tools/read-tool-registry.ts";

export async function inspectNode(
  state: typeof DemoState.State,
  scope: ExecutionScope,
  registry: ReadToolRegistry,
) {
  const result = await registry.invoke(
    "count_words", { text: state.normalized },
    { access: scope.identity.access, signal: scope.budget.signal },
  );
  if (typeof result !== "number" || !Number.isSafeInteger(result)) {
    throw new Error("Invalid demonstration tool result");
  }
  return { wordCount: result };
}
