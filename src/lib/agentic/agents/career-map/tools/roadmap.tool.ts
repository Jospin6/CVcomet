import { careerRoleById } from "./catalog.tool";
import type { RankedCareerRole } from "./rank.tool";

export type CareerMapRoleNode = Readonly<{
  id: string; title: string; compatibility: number;
  acquired: string[]; missing: string[]; explanation: string;
  plan: { id: string; title: string; order: number }[];
  evidence: RankedCareerRole["evidence"];
}>;
export type CareerMapGraph = Readonly<{
  nodes: CareerMapRoleNode[];
  edges: { from: "profile"; to: string }[];
  methodology: "catalog-skill-overlap";
  version: 2;
  disclaimer: string;
}>;

export function makeCareerMapGraph(roles: RankedCareerRole[]): CareerMapGraph {
  const nodes: CareerMapRoleNode[] = roles.map(item => {
    const role = careerRoleById(item.roleId);
    if (!role) throw Error("CAREER_MAP_UNKNOWN_ROLE");
    const coverage = Math.round(item.acquired.length * 100 / role.skills.length);
    return {
      id: role.id, title: role.title, compatibility: coverage,
      acquired: item.acquired, missing: item.missing,
      evidence: item.evidence,
      explanation: item.acquired.length
        ? `Your profile or selected resume mentions: ${item.acquired.join(", ")}. These are document mentions, not verified job competencies.`
        : "An exploratory path. No matching catalog skills were identified in your documents.",
      plan: item.missing.slice(0, 3).map((skill, index) => ({
        id: `${role.id}-${skill}`, title: `Develop or document ${skill}`, order: index + 1,
      })),
    };
  });
  return {
    nodes,
    edges: nodes.map(node => ({ from: "profile" as const, to: node.id })),
    methodology: "catalog-skill-overlap", version: 2,
    disclaimer: "Skill overlap in a curated catalog, not a hiring probability or a prediction of salary, employability or career outcomes.",
  };
}
