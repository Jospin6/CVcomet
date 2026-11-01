import type { CareerMapState } from "../agent/state";
import { verifyCareerMapGraph } from "../tools/verify.tool";
export function careerMapVerifyNode(state: typeof CareerMapState.State) {
  return { verified: verifyCareerMapGraph(state.graph) };
}
