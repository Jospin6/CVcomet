import type { CareerProfile } from "./schema";

/**
 * Professional information is collected once, in the owner's Career Profile.
 * These statements are self-reported, not independently verified.
 * Never promote a target role, industry or job posting to an achieved skill.
 */
export type CareerProfileFact = {
  kind: "EXPERIENCE" | "EDUCATION" | "PROJECT" | "CERTIFICATION" | "SKILL" | "AWARD" | "SUMMARY";
  statement: string;
  sourceLabel: "Career Profile";
};

function clean(value: unknown, limit = 1200): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, limit)
    : "";
}

export function profileFacts(profile: CareerProfile, limit = 50): CareerProfileFact[] {
  const facts: CareerProfileFact[] = [];
  const seen = new Set<string>();
  function add(kind: CareerProfileFact["kind"], parts: unknown[]) {
    const statement = parts.map(part => clean(part)).filter(Boolean).join(" — ").slice(0, 1400);
    const key = `${kind}:${statement.toLowerCase()}`;
    if (statement.length < 2 || seen.has(key) || facts.length >= Math.min(Math.max(limit, 0), 60)) return;
    seen.add(key);
    facts.push({ kind, statement, sourceLabel: "Career Profile" });
  }
  // Preserve the user's own descriptions; do not infer unrecorded achievements.
  for (const row of profile.experiences) add("EXPERIENCE", [row.title, row.company, row.start, row.end, row.description]);
  for (const row of profile.education) add("EDUCATION", [row.degree, row.school, row.start, row.end, row.description]);
  for (const row of profile.projects) add("PROJECT", [row.title, row.description, row.url]);
  for (const row of profile.certifications) add("CERTIFICATION", [row.name, row.organization, row.date, row.description]);
  for (const row of profile.awards) add("AWARD", [row.title, row.organization, row.date, row.description]);
  for (const skill of profile.skills.split(/[,;\n]/)) add("SKILL", [skill]);
  // User-supplied headline and summary may be paraphrased but are not verified.
  add("SUMMARY", [profile.headline]);
  add("SUMMARY", [profile.summary]);
  return facts;
}

