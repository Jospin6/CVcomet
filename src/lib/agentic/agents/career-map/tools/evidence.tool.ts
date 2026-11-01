import type { CareerProfile, ProfileData } from "@/lib/career-profile/schema";

/** Every observed skill must be traceable to a user's existing career document. */
export type SelectedCareerResume = Readonly<{
  id: string; title: string;
  skills: unknown; experiences: unknown; projects: unknown;
  educations: unknown; certifications: unknown; languages: unknown;
}>;
export type EvidenceSource =
  | "profile.skills" | "profile.experiences" | "profile.projects" | "profile.certifications"
  | "resume.skills" | "resume.experiences" | "resume.projects" | "resume.certifications";
export type CareerEvidence = Readonly<{ source: EvidenceSource; text: string }>;

/** Do not inspect target job title, desired roles, interests, or headings as qualifications. */
export function extractCareerEvidence(profile: CareerProfile | ProfileData, cv: SelectedCareerResume | null): CareerEvidence[] {
  const sources: CareerEvidence[] = [];
  const push = (source: EvidenceSource, value: unknown) => {
    if (typeof value === "string" && value.trim()) {
      sources.push({ source, text: value.slice(0, 8_000) });
    }
  };
  push("profile.skills", profile.skills);
  for (const experience of profile.experiences.slice(0, 50)) {
    push("profile.experiences", experience.description);
  }
  for (const project of profile.projects.slice(0, 50)) {
    push("profile.projects", project.description);
  }
  for (const certification of profile.certifications.slice(0, 50)) {
    push("profile.certifications", certification.name);
    push("profile.certifications", certification.description);
  }
  if (cv) {
    for (const value of flattenCandidateText(cv.skills)) push("resume.skills", value);
    for (const value of flattenCandidateText(cv.experiences, "description")) push("resume.experiences", value);
    for (const value of flattenCandidateText(cv.projects, "description")) push("resume.projects", value);
    for (const value of flattenCandidateText(cv.certifications, "name")) push("resume.certifications", value);
  }
  return sources.slice(0, 250);
}

/** JSON from older resume editors can be nested. Only declared text/description
 * fields are accepted, with limits against oversized or cyclic payloads. */
export function flattenCandidateText(value: unknown, field?: "description" | "name"): string[] {
  const out: string[] = [];
  const seen = new WeakSet<object>();
  let inspected = 0;
  const visit = (item: unknown, depth: number) => {
    if (inspected++ > 400 || depth > 6 || out.length >= 90) return;
    if (typeof item === "string") {
      if (item.trim()) out.push(item.slice(0, 4_000));
      return;
    }
    if (!item || typeof item !== "object" || seen.has(item)) return;
    seen.add(item);
    if (Array.isArray(item)) { for (const member of item.slice(0, 80)) visit(member, depth + 1); return; }
    for (const [key, member] of Object.entries(item)) {
      if (/^(id|url|href|link|email|phone|address|title|company|school|organization|date|start|end|location|role|level|period)$/i.test(key)) continue;
      if (field && key.toLowerCase() !== field &&
          !(field === "description" && ["bullets", "details", "content", "achievements"].includes(key.toLowerCase())) &&
          !(field === "name" && ["description", "details", "certifications"].includes(key.toLowerCase()))) {
        if (member && typeof member === "object") visit(member, depth + 1);
        continue;
      }
      visit(member, depth + 1);
    }
  };
  visit(value, 0);
  return out;
}

export function normalizeCareerText(value: string) {
  return value.normalize("NFKC").toLowerCase()
    .replace(/[^\p{L}\p{N}+#./]+/gu, " ").trim();
}

/** Small, reviewed aliases are evidence terms, not LLM-generated guesses. */
const knownSkillAliases: Record<string, string[]> = {
  node: ["node.js", "nodejs"], python: ["python3", "python 3"],
  cloud: ["aws", "azure", "google cloud", "gcp"],
  llm: ["large language model", "large language models"],
  rag: ["retrieval augmented generation", "retrieval-augmented generation"],
  api: ["apis", "restful apis"],
};

/** Whole phrase only; avoid claiming "AI" from "said" and negative mentions. */
export function evidenceMentionsSkill(text: string, skill: string) {
  const content = ` ${normalizeCareerText(text)} `;
  for (const candidate of [skill, ...(knownSkillAliases[skill] ?? [])]) {
    const token = ` ${normalizeCareerText(candidate)} `;
    if (token.length <= 2) continue;
    let index = -1;
    while ((index = content.indexOf(token, index + 1)) >= 0) {
      const prefix = content.slice(Math.max(0, index - 64), index).trimEnd();
      if (!/(?:no experience (?:with|in)|without|lack of|lacking|not familiar with|aucune experience (?:en|avec)|sans experience (?:en|avec))\s*$/i.test(prefix)) return true;
    }
  }
  return false;
}
