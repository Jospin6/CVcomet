import { createHash } from "node:crypto";
import type { CareerProfile } from "@/lib/career-profile/schema";
import type { EvidenceKind } from "./contracts";

export type ProfileEvidenceCandidate = {
  kind: EvidenceKind; statement: string; sourceLabel: string; sourceKey: string;
};

function clean(value: unknown, max = 1600): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}
function key(type: string, value: string) {
  return `profile:${type}:${createHash("sha256").update(value).digest("hex").slice(0, 40)}`;
}
/** Snapshot import is opt-in. Imported content remains DRAFT until the user confirms. */
export function extractProfileEvidence(profile: CareerProfile): ProfileEvidenceCandidate[] {
  const output: ProfileEvidenceCandidate[] = [];
  const seen = new Set<string>();
  function add(kind: EvidenceKind, statement: string, category: string, identity: string) {
    const normalized = clean(statement);
    if (normalized.length < 2 || output.length >= 50) return;
    const sourceKey = key(category, identity);
    if (seen.has(sourceKey)) return;
    seen.add(sourceKey);
    output.push({ kind, statement: normalized, sourceLabel: "Profil professionnel CVComet", sourceKey });
  }
  // Prefer structured experience records to loosely generated prose.
  for (const x of profile.experiences.slice(0, 15)) {
    add("EXPERIENCE", [x.title, x.company && `chez ${x.company}`, x.start && `(${x.start}${x.end ? ` – ${x.end}` : ""})`, x.description].filter(Boolean).join(" — "), "experience", x.id || `${x.title}:${x.company}:${x.start}`);
  }
  for (const x of profile.education.slice(0, 10)) {
    add("EDUCATION", [x.degree, x.school, x.start && `(${x.start}${x.end ? ` – ${x.end}` : ""})`].filter(Boolean).join(" — "), "education", x.id || `${x.degree}:${x.school}`);
  }
  for (const x of profile.projects.slice(0, 10)) {
    add("PROJECT", [x.title, x.description].filter(Boolean).join(" — "), "project", x.id || x.title);
  }
  for (const x of profile.certifications.slice(0, 10)) {
    add("CERTIFICATION", [x.name, x.organization, x.date].filter(Boolean).join(" — "), "cert", x.id || x.name);
  }
  for (const skill of (profile.skills || "").split(/[,;\n]/).slice(0, 30)) {
    const name = clean(skill, 160);
    add("SKILL", name, "skill", name.toLowerCase());
  }
  return output.slice(0, 50);
}
