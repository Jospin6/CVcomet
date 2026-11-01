import { roleCatalog } from "./catalog.tool";
import { evidenceMentionsSkill, type CareerEvidence, type EvidenceSource, normalizeCareerText } from "./evidence.tool";
import type { CareerMapPreferences } from "./preferences.tool";

export type RankedCareerRole = Readonly<{
  roleId: string;
  title: string;
  acquired: string[];
  missing: string[];
  evidence: { skill: string; sources: EvidenceSource[] }[];
  priority: number;
}>;

/** Only the ordering reflects preferences. Coverage strictly reflects documents. */
export function rankCareerRoles(sources: CareerEvidence[], preferences: CareerMapPreferences): RankedCareerRole[] {
  const targets = new Set(preferences.targetRoles.map(normalizeCareerText).filter(Boolean));
  const interests = preferences.interests.map(normalizeCareerText).filter(Boolean);
  return roleCatalog.map(role => {
    const evidence = role.skills.flatMap(skill => {
      const matching = [...new Set(sources.filter(source => evidenceMentionsSkill(source.text, skill))
        .map(source => source.source))];
      return matching.length ? [{ skill, sources: matching }] : [];
    });
    const acquired = evidence.map(item => item.skill);
    const missing = role.skills.filter(skill => !acquired.includes(skill));
    const target = targets.has(normalizeCareerText(role.title));
    const interest = interests.some(term => normalizeCareerText(role.title).includes(term));
    const identityBonus = preferences.identity === "FOUNDER" && role.id === "technical-founder"
      ? 2 : preferences.identity === "GENERALIST" && (role.id.includes("product") || role.id.includes("architect")) ? 1 : 0;
    const advancement = preferences.goal === "ADVANCEMENT" && /senior|manager|director|architect/i.test(role.title) ? 1 : 0;
    return {
      roleId: role.id, title: role.title, acquired, missing, evidence,
      priority: (target ? 20 : 0) + (interest ? 4 : 0) + acquired.length * 2 + identityBonus + advancement,
    };
  }).sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title))
    .slice(0, preferences.positions);
}
