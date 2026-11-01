import { interrupt } from "@langchain/langgraph";
import type { DurableDemoState } from "../agent/durable-state.ts";

/** Pure HITL example. Side effects MUST NOT occur before interrupt(). */
export function askDemoApproval(_state: typeof DurableDemoState.State) {
  const decision = interrupt({ kind: "demo.approval", label: "Approve this read-only demonstration?" });
  if (typeof decision !== "boolean") {
    throw new Error("Invalid demo approval response");
  }
  return { confirmed: decision };
}
