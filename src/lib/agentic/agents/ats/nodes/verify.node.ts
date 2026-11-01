import type { AtsAgentState } from "../agent/state";
import { verifyAtsReport } from "../tools/verify.tool";

export function atsVerifyNode(state: typeof AtsAgentState.State) {
  if (!state.report) throw new Error("ATS_REPORT_MISSING");
  verifyAtsReport(state.report);
  return { verified: true };
}
