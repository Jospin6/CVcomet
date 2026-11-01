import type { CareerMapState } from "../agent/state";
import { rankCareerRoles } from "../tools/rank.tool";
export function careerMapRankNode(state: typeof CareerMapState.State) {
  return { ranked: rankCareerRoles(state.evidence, state.input.preferences) };
}
