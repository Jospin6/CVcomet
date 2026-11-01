import type { CareerMapState } from "../agent/state";
import { makeCareerMapGraph } from "../tools/roadmap.tool";
export function careerMapRoadmapNode(state: typeof CareerMapState.State) {
  return { graph: makeCareerMapGraph(state.ranked) };
}
