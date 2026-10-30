import { z } from "zod";
import type { EditorResume } from "@/lib/resume-editor";
import type { UnifiedJob } from "./types";
import { countryCodesForJob } from "./facets";

/** Saved per user; all values are optional and never guessed from an advert. */
export const matchingPreferencesSchema = z.object({
  cvId: z.string().uuid().nullable().default(null),
  title: z.string().trim().max(100).default(""),
  countries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(15).default([]),
  postedWithin: z.enum(["any", "day", "week", "month"]).default("any"),
  contracts: z.array(z.enum([
    "full-time", "part-time", "contract", "temporary",
    "internship", "volunteer", "other",
  ])).max(7).default([]),
  seniorities: z.array(z.enum([
    "entry", "mid", "senior", "executive",
  ])).max(4).default([]),
  workplaces: z.array(z.enum(["remote", "hybrid", "onsite"]))
    .max(3).default([]),
  minimumAnnualUsd: z.number().int().min(0).max(2_000_000).nullable()
    .default(null),
  visaSponsorship: z.boolean().default(false),
}).strict();

export type MatchingPreferences = z.infer<typeof matchingPreferencesSchema>;
export const defaultMatchingPreferences = matchingPreferencesSchema.parse({});

export function resumeEvidence(resume: EditorResume): string {
  return [
    resume.title,
    ...resume.summary,
    ...resume.skills.flatMap((item) => Object.values(item)),
    ...resume.experiences.flatMap((item) => [
      item.title, item.company, ...item.description,
    ]),
    ...resume.educations.flatMap((item) => [
      item.degree, item.school, ...item.description,
    ]),
    ...resume.projects.flatMap((item) => [
      item.title, item.description, item.technologies,
    ]),
    ...resume.certifications.flatMap((item) => [
      item.title, item.issuer, item.description,
    ]),
    ...resume.languages.map((item) => `${item.language} ${item.level}`),
  ].filter(Boolean).join("\n").slice(0, 12000);
}

const lower = (value: string | null | undefined) =>
  (value || "").toLowerCase();

/** Filters require evidence in the job record; unknown facts never pass strict filters. */
export function matchesPreferences(
  job: UnifiedJob,
  prefs: MatchingPreferences,
  now = Date.now(),
): boolean {
  if (prefs.title && !lower(`${job.title} ${job.description}`)
    .includes(lower(prefs.title))) return false;

  if (prefs.countries.length &&
    !countryCodesForJob(job).some((code) => prefs.countries.includes(code))) {
    // Jobs explicitly open to everyone need not name a single country.
    if (!(job.eligibleCountries || []).some((country) =>
      /^(worldwide|global|anywhere)$/i.test(country.trim()))) return false;
  }

  const maxAge = {
    any: Infinity,
    day: 86400000,
    week: 7 * 86400000,
    month: 30 * 86400000,
  }[prefs.postedWithin];
  if (Number.isFinite(maxAge)) {
    const date = Date.parse(job.publishedAt || "");
    if (!Number.isFinite(date) || date > now || now - date > maxAge) {
      return false;
    }
  }

  if (prefs.contracts.length) {
    const kind = lower(job.contractType).replace(/[\s_]+/g, "-");
    if (!prefs.contracts.some((value) => {
      if (value === "full-time") return /full-time|fulltime|permanent/.test(kind);
      if (value === "part-time") return /part-time|parttime/.test(kind);
      if (value === "contract") return /contract|freelance/.test(kind);
      if (value === "internship") return /intern|trainee|stage/.test(kind);
      if (value === "temporary") return /temporary|seasonal|temp/.test(kind);
      if (value === "volunteer") return /volunteer|bénévol/.test(kind);
      return /other/.test(kind);
    })) return false;
  }

  if (prefs.seniorities.length) {
    const text = lower(`${job.seniority || ""} ${job.title}`);
    if (!prefs.seniorities.some((level) => {
      if (level === "entry") return /entry|junior|intern|graduate|trainee/.test(text);
      if (level === "mid") return /mid.level|intermediate|associate/.test(text);
      if (level === "senior") return /senior|lead|principal|staff/.test(text);
      return /director|executive|vp\b|chief|head of/.test(text);
    })) return false;
  }

  if (prefs.workplaces.length) {
    const description = lower(`${job.location || ""} ${job.title}`);
    const remote = job.remote === true || /\bremote\b/.test(description);
    const hybrid = /\bhybrid\b|hybride/.test(description);
    const onsite = job.remote === false && !hybrid || /on.site|on site/.test(description);
    if (!prefs.workplaces.some((place) =>
      place === "remote" ? remote : place === "hybrid" ? hybrid : onsite,
    )) return false;
  }

  if (prefs.minimumAnnualUsd !== null) {
    // Salary frequency/currency is often absent. Do not convert or guess.
    const annual = /\b(annual|annually|per year|\/year|\/yr|yearly)\b/i
      .test(job.description.slice(0, 4000));
    if (job.currency?.toUpperCase() !== "USD" ||
      job.salaryMax === null || !annual ||
      job.salaryMax < prefs.minimumAnnualUsd) return false;
  }

  if (prefs.visaSponsorship && !/\bvisa sponsorship (?:available|provided|offered)|sponsor(?:s|ing)? work visas\b/i
    .test(job.description)) return false;

  return true;
}

export type CheckedRequirement = {
  criterion: string;
  status: "MET" | "PARTIAL" | "NOT_EVIDENCED" | "UNCERTAIN";
  evidence: string;
  jobQuote: string;
  priority: "REQUIRED" | "PREFERRED";
};

/** Check source quotes before awarding a score: the LLM cannot create evidence. */
export function verifiedMatchScore(
  resumeText: string,
  description: string,
  requirements: CheckedRequirement[],
) {
  const normalized = (value: string) => value
    .toLocaleLowerCase().replace(/\s+/g, " ").trim();
  const resumeSource = normalized(resumeText);
  const jobSource = normalized(description);
  const validated = requirements.filter((r) => r.criterion.trim() &&
    r.jobQuote.trim().length >= 8 &&
    jobSource.includes(normalized(r.jobQuote)))
    .slice(0, 10).map((r) => {
      const hasEvidence = r.evidence.trim().length >= 5 &&
        resumeSource.includes(normalized(r.evidence));
      return {
        ...r,
        status: r.status === "MET" || r.status === "PARTIAL"
          ? hasEvidence ? r.status : "UNCERTAIN" as const
          : r.status,
        evidence: hasEvidence ? r.evidence : "",
      };
    });
  const definite = validated.filter((r) => r.status !== "UNCERTAIN");
  if (definite.length < 2) return {
    score: null, matched: [], missing: [],
    explanation: "Insufficient verified criteria to calculate a match.",
  };
  const weight = (item: CheckedRequirement) =>
    item.priority === "REQUIRED" ? 2 : 1;
  const total = definite.reduce((sum, item) => sum + weight(item), 0);
  const earned = definite.reduce((sum, item) => sum + weight(item) * (
    item.status === "MET" ? 1 : item.status === "PARTIAL" ? 0.5 : 0
  ), 0);
  return {
    score: Math.round(earned / total * 100),
    matched: definite.filter((r) => r.status === "MET")
      .map((r) => r.criterion).slice(0, 6),
    missing: definite.filter((r) => r.status === "NOT_EVIDENCED")
      .map((r) => r.criterion).slice(0, 6),
    explanation: `${definite.length} verified requirements assessed from this resume.`,
  };
}
