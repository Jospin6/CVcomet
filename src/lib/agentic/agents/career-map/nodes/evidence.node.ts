import type { CareerMapState } from "../agent/state";
import { extractCareerEvidence } from "../tools/evidence.tool";
export function careerMapEvidenceNode(state: typeof CareerMapState.State) {
  return { evidence: extractCareerEvidence(state.input.profile, state.input.cv) };
}
