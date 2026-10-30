import type { JobAnalysis, MatchResult, RequirementResult } from "./job-schema";

/** Explainability layer. This is a document-evidence review, NEVER a probability
 * of hiring, legal eligibility decision or independently verified qualification. */
export type IntelligenceAction = {
  requirementId: string;
  title: string;
  priority: RequirementResult["priority"];
  category: RequirementResult["category"];
  status: RequirementResult["status"];
  kind: "VERIFY" | "ADD_REAL_EXAMPLE" | "REVIEW_GAP" | "HIGHLIGHT";
  why: string;
  nextStep: string;
  postingQuote: string;
  candidateSources: { path: string; label: string; quote: string }[];
};

export type JobIntelligence = {
  version: 2;
  assessment: "INSUFFICIENT_DATA" | "PARTIAL_REVIEW" | "REVIEWABLE";
  coveragePercent: number;
  demonstratedCount: number;
  partialCount: number;
  missingCount: number;
  verifyCount: number;
  hasResume: boolean;
  warnings: string[];
  actions: IntelligenceAction[];
};

const importance = { REQUIRED: 0, PREFERRED: 1, MENTIONED: 2 } as const;
const urgency = { VERIFY: 0, NOT_DEMONSTRATED: 1, PARTIAL: 2, DEMONSTRATED: 3 } as const;
const translate = (language: "fr" | "en", fr: string, en: string) => language === "fr" ? fr : en;

/** Pure and deterministic: consumes ONLY a source-anchored analysis and an
 * already computed match; does not hallucinate requirements or candidates. */
export function buildJobIntelligence(
  analysis: Pick<JobAnalysis, "requirements" | "warnings">,
  match: Pick<MatchResult, "requirements" | "evaluatedCount" | "totalCount" | "unverifiedCount" | "overallScore" | "source">,
  language: "fr" | "en" = "fr",
): JobIntelligence {
  const total = match.requirements.length;
  const coveragePercent = total ? Math.round(match.requirements.filter(item => item.status !== "VERIFY").length / total * 100) : 0;
  const assessment: JobIntelligence["assessment"] = !total || match.overallScore === null
    ? "INSUFFICIENT_DATA" : coveragePercent < 100 ? "PARTIAL_REVIEW" : "REVIEWABLE";
  const count = (status: RequirementResult["status"]) => match.requirements.filter(item => item.status === status).length;
  const hasResume = match.source === "PROFILE_AND_RESUME";
  const warnings = [
    translate(language, "Les scores évaluent uniquement les éléments présents dans vos données. Ils ne prédisent pas l’embauche ni le résultat d’un ATS.",
      "Scores assess only available candidate data. They do not predict hiring or ATS outcomes."),
    translate(language, "Les éléments du profil et du CV sont déclaratifs et ne sont pas vérifiés indépendamment.",
      "Profile and resume statements are self-reported, not independently verified."),
  ];
  if (!hasResume) warnings.push(translate(language,
    "Aucun CV sélectionné : la correspondance porte sur le profil, pas sur le document réellement envoyé.",
    "No resume selected: the comparison covers the profile, not the document submitted to an employer."));
  if (match.unverifiedCount > 0) warnings.push(translate(language,
    "Certaines exigences sont ambiguës ou non vérifiables ; ne les considérez pas comme remplies ou manquantes.",
    "Some requirements are ambiguous or unverifiable; do not treat them as either satisfied or missing."));
  if (!total) warnings.push(translate(language,
    "Aucune exigence exploitable n’a été extraite de l’offre : aucune conclusion de correspondance n’est possible.",
    "No usable requirements were extracted from the posting; a match conclusion is not possible."));
  for (const warning of analysis.warnings.slice(0, 4)) if (warning.trim()) warnings.push(warning.trim().slice(0, 400));

  const actions = [...match.requirements]
    .sort((a, b) => importance[a.priority] - importance[b.priority] || urgency[a.status] - urgency[b.status])
    .slice(0, 12)
    .map(item => {
      const kind: IntelligenceAction["kind"] = item.status === "VERIFY" ? "VERIFY"
        : item.status === "PARTIAL" ? "ADD_REAL_EXAMPLE"
        : item.status === "NOT_DEMONSTRATED" ? "REVIEW_GAP" : "HIGHLIGHT";
      const instructions = {
        VERIFY: translate(language, "Vérifiez ce critère dans l’offre et votre parcours. Demandez une clarification si nécessaire ; n’affirmez rien sans preuve.",
          "Verify this criterion against the posting and your history. Ask for clarification if necessary; do not claim unsupported facts."),
        ADD_REAL_EXAMPLE: translate(language, "Si vous avez réellement cette compétence, ajoutez un projet, une mission ou un résultat précis qui la démontre.",
          "If you truly have this skill, add a specific real project, responsibility or result showing its use."),
        REVIEW_GAP: translate(language, "Examinez cet écart. S’il manque seulement une preuve, complétez votre profil ou CV avec un fait réel ; sinon, conservez l’écart.",
          "Review this gap. If only evidence is missing, add a truthful fact to your profile or resume; otherwise keep the gap."),
        HIGHLIGHT: translate(language, "Conservez une preuve pertinente et facile à repérer dans le CV ciblé, sans dupliquer ni exagérer.",
          "Keep this relevant evidence easy to find in the tailored resume without duplication or exaggeration."),
      };
      return {
        requirementId: item.id, title: item.title, priority: item.priority, category: item.category,
        status: item.status, kind,
        why: item.explanation, nextStep: instructions[kind],
        postingQuote: item.evidence.slice(0, 500),
        candidateSources: item.evidenceSources.slice(0, 3).map(source => ({
          path: source.path.slice(0, 160), label: source.label.slice(0, 160), quote: source.quote.slice(0, 500),
        })),
      };
    });
  return { version: 2, assessment, coveragePercent, demonstratedCount: count("DEMONSTRATED"),
    partialCount: count("PARTIAL"), missingCount: count("NOT_DEMONSTRATED"), verifyCount: count("VERIFY"),
    hasResume, warnings, actions };
}

/** Older stored JSON snapshots are untrusted at the boundary. Reject malformed
 * records before exposing any AI-facing read tool or deriving an action plan. */
export function isReadableMatchSnapshot(value: unknown): value is MatchResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (item.version !== 1 || !["PROFILE", "PROFILE_AND_RESUME"].includes(String(item.source)) ||
      !Array.isArray(item.requirements) || item.requirements.length > 80 ||
      (item.overallScore !== null && (typeof item.overallScore !== "number" || !Number.isFinite(item.overallScore) || item.overallScore < 0 || item.overallScore > 100))) return false;
  return item.requirements.every(row => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return false;
    const req = row as Record<string, unknown>;
    if (typeof req.id !== "string" || req.id.length > 80 || typeof req.title !== "string" || req.title.length > 200 ||
        typeof req.evidence !== "string" || req.evidence.length > 1600 || typeof req.explanation !== "string" ||
        !["REQUIRED", "PREFERRED", "MENTIONED"].includes(String(req.priority)) ||
        !["DEMONSTRATED", "PARTIAL", "NOT_DEMONSTRATED", "VERIFY"].includes(String(req.status)) ||
        !["TECHNICAL", "SOFT_SKILL", "EXPERIENCE", "EDUCATION", "CERTIFICATION", "LANGUAGE", "ELIGIBILITY", "OTHER"].includes(String(req.category)) ||
        !Array.isArray(req.evidenceSources) || req.evidenceSources.length > 8) return false;
    return req.evidenceSources.every(source => {
      if (!source || typeof source !== "object" || Array.isArray(source)) return false;
      const evidence = source as Record<string, unknown>;
      return typeof evidence.path === "string" && evidence.path.length <= 200 &&
        typeof evidence.label === "string" && evidence.label.length <= 300 &&
        typeof evidence.quote === "string" && evidence.quote.length <= 5000;
    });
  });
}
