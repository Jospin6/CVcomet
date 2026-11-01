import type { AtsAgentState } from "../agent/state";
import { assembleAtsReport } from "../tools/assemble.tool";

export function atsAssembleNode(state: typeof AtsAgentState.State) {
  if (!state.input || !state.plan || !state.semantic || !state.jobMatch) {
    throw new Error("ATS_ASSEMBLY_INPUT_MISSING");
  }
  return { report: assembleAtsReport(state.input, state.plan.visible, state.semantic, state.jobMatch) };
}
