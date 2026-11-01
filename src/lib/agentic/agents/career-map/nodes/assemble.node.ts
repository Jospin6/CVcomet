import type { CareerMapState } from "../agent/state";
export function careerMapAssembleNode(state: typeof CareerMapState.State) {
  if (!state.verified) throw Error("CAREER_MAP_UNVERIFIED");
  return { result: { graph: state.graph, snapshot: state.snapshot } };
}
