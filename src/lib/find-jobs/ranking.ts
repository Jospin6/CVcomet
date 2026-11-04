import type { UnifiedJob } from "./types";

/** Evidence-based, explainable *relevance*, never a probability of hiring or eligibility. */
export type CandidatePreferences = {
  headline?: string; targetJobTitle?: string; targetIndustry?: string; skills?: string;
  experienceLevel?: string; targetCountry?: string; address?: string; preferredWorkMode?: string;
  experiences?: Array<{ title?: string; description?: string }>;
};
const stop = new Set("and the for with from de des les une un pour dans sur chez avec en et du la le des senior junior remote job position emploi travail engineer developer software specialist manager analyst officer specialist remote fulltime full time".split(" "));
const shortSkillTokens = new Set(["ai", "ml", "ux", "ui", "qa"]);
const words = (value: string) => new Set(value.toLowerCase()
  .split(/[^\p{L}\p{N}+#.]+/u)
  .filter(x => x.length > 2 || shortSkillTokens.has(x)));
const meaningful = (value: string) => [...words(value)]
  .filter(t => !stop.has(t) && (t.length >= 3 || shortSkillTokens.has(t)));
const groups: string[][] = [
  ["software", "developer", "développeur", "backend", "frontend", "fullstack", "programmer", "typescript", "javascript", "react", "node"],
  ["support", "customer", "service", "client", "assistance", "helpdesk"],
  ["marketing", "growth", "seo", "acquisition", "commercial", "sales", "vente"],
  ["finance", "accounting", "comptabilité", "comptable", "audit", "accountant"],
  ["design", "designer", "ux", "ui", "figma", "graphique"],
  ["data", "analyst", "analytics", "scientist", "machine", "learning", "artificial", "intelligence", "ai", "ml", "llm", "nlp", "pytorch", "tensorflow", "statistiques"],
  ["health", "medical", "nurse", "infirmier", "clinique", "hospital"],
  ["education", "teacher", "professeur", "teaching", "formateur", "enseignement"],
];
function roleDomains(value: string) {
  const tokens = words(value);
  return groups.map((group, index) => group.some(word => tokens.has(word)) ? index : -1).filter(index => index >= 0);
}
export function rankJobs(jobs: UnifiedJob[], candidate: CandidatePreferences | string) {
  const p: CandidatePreferences = typeof candidate === "string" ? { skills: candidate } : candidate;
  const profileRole = `${p.targetJobTitle || ""} ${p.headline || ""} ${(p.experiences || []).slice(0, 3).map(x => x.title || "").join(" ")}`;
  const profileSkills = `${p.skills || ""} ${(p.experiences || []).slice(0, 3).map(x => x.description || "").join(" ")}`;
  const wanted = meaningful(profileRole), skillTerms = meaningful(profileSkills);
  const all = new Set([...wanted, ...skillTerms]);
  const domains = roleDomains(`${profileRole} ${p.targetIndustry || ""}`);
  const country = (p.targetCountry || p.address || "").toLowerCase().trim();
  return jobs.map(job => {
    const titleTokens = meaningful(job.title);
    const roleMatches = titleTokens.filter(t => wanted.includes(t));
    const domainMatches = roleDomains(`${job.title} ${job.skills.join(" ")}`);
    const conflictingDomain = domains.length > 0 && domainMatches.length > 0 && !domainMatches.some(x => domains.includes(x));
    const skillMatches = [...new Set([...job.skills.flatMap(meaningful), ...meaningful(job.description).slice(0, 80)])].filter(t => skillTerms.includes(t)).slice(0, 12);
    const skillCoverage = job.skills.length ? skillMatches.length / Math.max(1, meaningful(job.skills.join(" ")).length) : Math.min(1, skillMatches.length / 5);
    const domainFit = domains.length && domainMatches.length && domainMatches.some(x => domains.includes(x));
    const roleFit = roleMatches.length ? Math.min(1, roleMatches.length / Math.max(1, wanted.length)) : 0;
    const seniority = (job.seniority || job.title).toLowerCase();
    const level = (p.experienceLevel || "").toLowerCase();
    const levelConflict = (level.includes("junior") || level.includes("entry")) && /\b(senior|lead|principal|director)\b/i.test(seniority);
    const regionRestricted = Boolean(country && job.eligibleCountries.length && !job.eligibleCountries.some(value => country.includes(value.toLowerCase()) || value.toLowerCase().includes(country)) && !job.eligibleCountries.some(value => /worldwide|global|anywhere/i.test(value)));
    const preferRemote = /remote|télétravail|distance/i.test(p.preferredWorkMode || "");
    const jobRemote = job.remote === true || /remote|télétravail|worldwide/i.test(job.location || "");
    const score = Math.max(0, Math.min(95, Math.round(8 + 34 * roleFit + (domainFit ? 28 : 0) + 23 * skillCoverage + (preferRemote && jobRemote ? 5 : 0) - (conflictingDomain ? 32 : 0) - (levelConflict ? 16 : 0) - (regionRestricted ? 30 : 0))));
    const warnings = [levelConflict ? "Niveau de séniorité potentiellement trop élevé" : "", regionRestricted ? "Restriction géographique à vérifier" : ""].filter(Boolean);
    const signals = [roleMatches.length ? `Métier : ${roleMatches.slice(0, 3).join(", ")}` : "", domainFit ? "Domaine cohérent" : "", skillMatches.length ? `Compétences : ${skillMatches.slice(0, 5).join(", ")}` : "", ...warnings].filter(Boolean);
    return { ...job, match: {
      score, matched: [...roleMatches, ...skillMatches].slice(0, 8), missing: titleTokens.filter(t => !all.has(t)).slice(0, 8),
      relevant: !conflictingDomain && !regionRestricted && (domainFit || roleMatches.length > 0 || (!domains.length && skillMatches.length >= 2)),
      explanation: signals.join(" · ") || "Aucun rapprochement professionnel suffisamment documenté. Vérifiez les exigences.",
      warnings,
    } };
  }).sort((a, b) => b.match.score - a.match.score);
}
