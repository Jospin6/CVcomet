import { careerRoleById } from "./catalog.tool";
import type { CareerMapGraph } from "./roadmap.tool";

/** Final graph invariant check: no ungrounded skill and no invented path/score. */
export function verifyCareerMapGraph(graph: CareerMapGraph) {
  if (graph.nodes.length < 4 || graph.nodes.length > 12 || graph.edges.length !== graph.nodes.length) {
    throw Error("CAREER_MAP_INVALID_GRAPH");
  }
  const ids = new Set<string>();
  for (const [index, node] of graph.nodes.entries()) {
    const role = careerRoleById(node.id);
    if (!role || ids.has(node.id) || role.title !== node.title ||
        graph.edges[index]?.from !== "profile" || graph.edges[index]?.to !== node.id) {
      throw Error("CAREER_MAP_INVALID_ROLE");
    }
    ids.add(node.id);
    const supported = new Set(node.evidence.filter(e => e.sources.length > 0).map(e => e.skill));
    if (node.acquired.length + node.missing.length !== role.skills.length ||
        node.acquired.some(skill => !role.skills.includes(skill as never) || !supported.has(skill)) ||
        node.missing.some(skill => !role.skills.includes(skill as never) || supported.has(skill)) ||
        node.compatibility !== Math.round(node.acquired.length * 100 / role.skills.length) ||
        node.plan.some(step => !node.missing.includes(step.id.slice(`${node.id}-`.length)) ||
          !step.id.startsWith(`${node.id}-`) || step.order < 1 || step.order > 3)) {
      throw Error("CAREER_MAP_INVALID_EVIDENCE");
    }
  }
  return true;
}
