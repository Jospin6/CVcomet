import { generateText, type LanguageModel } from "ai";
import { parseAtsJsonObject } from "@/lib/agentic/agents/ats/tools/parse-json.tool";
import { normalizeAtsReviewShape } from "@/lib/agentic/agents/ats/tools/normalize-review.tool";
import { z } from "zod";
import { atsEvidenceReviewSystemPrompt, atsEvidenceReviewUserPrompt } from "@/lib/agentic/agents/ats/prompts/review.prompt";
import { ProfileError } from "@/lib/career-profile/http";
import type { EditorResume } from "@/lib/resume-editor";
import { atsClaimedSkills, atsEvidence, atsWorkEvidence, normalizeAtsText } from "./ats-text";
import type { AtsEvidence, SemanticReview } from "./ats-types";

const evidenceSchema = z.object({ field: z.string().min(1).max(150), quote: z.string().min(1).max(8000) }).strict();
// Recommendations are optional for scoring. A malformed suggestion must not
// invalidate otherwise evidenced criteria, so validate each independently.
const atsReviewIssueSchema = z.object({ field: z.string().min(1).max(150), severity: z.enum(["critical", "warning", "info"]), title: z.string().min(1).max(200), reason: z.string().min(10).max(1600), suggestion: z.string().min(10).max(2000), quote: z.string().min(1).max(8000), proposedText: z.string().max(8000) }).strict();
export const atsReviewSchema = z.object({
  skillEvidence: z.array(z.object({ skill: z.string().min(1).max(1000), status: z.enum(["DEMONSTRATED", "PARTIAL", "UNSUPPORTED"]), evidence: z.array(evidenceSchema).max(5) }).strict()).max(240),
  contributions: z.array(z.object({ field: z.string().min(1).max(150), actionQuote: z.string().max(8000), methodQuote: z.string().max(8000), outcomeQuote: z.string().max(8000), outcomeType: z.enum(["OBSERVED", "TASK_ONLY", "NOT_STATED"]) }).strict()).max(100),
  criteria: z.array(z.object({ id: z.enum(["specificity", "positioning", "writing"]), rating: z.number().int().min(0).max(4), reason: z.string().min(10).max(1800), evidence: z.array(evidenceSchema).max(8) }).strict()).length(3),
  issues: z.array(z.unknown()).max(25),
}).strict();
const exact = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim();
const practical = (field: string) => /^(?:experiences|projects)\.\d+\.description$/.test(field);

export function validateAtsReview(value: unknown, resume: EditorResume, language: "fr" | "en" = "en"): SemanticReview {
  const normalized = normalizeAtsReviewShape(value);
  if (normalized && typeof normalized === "object" && !Array.isArray(normalized)) {
    const object = normalized as Record<string, unknown>;
    // Empty arrays omitted by the model can safely be reconstructed only when
    // the original CV actually has no corresponding entries.
    if (object.skillEvidence == null && atsClaimedSkills(resume).length === 0) object.skillEvidence = [];
    if (object.contributions == null && atsWorkEvidence(resume).filter(item => practical(item.field)).length === 0) object.contributions = [];
  }
  const parsed = atsReviewSchema.parse(normalized), fields = new Map(atsEvidence(resume).map(item => [item.field, item.quote]));
  const validateEvidence = (evidence: AtsEvidence) => {
    const actual = fields.get(evidence.field);
    if (!actual || !exact(actual).includes(exact(evidence.quote))) throw new ProfileError(502, "AI_UNSUPPORTED_EVIDENCE");
    return evidence;
  };
  if (new Set(parsed.criteria.map(item => item.id)).size !== 3) throw new ProfileError(502, "AI_INVALID_RESPONSE");
  const work = atsWorkEvidence(resume).filter(item => practical(item.field));
  const contributions = parsed.contributions.map(item => {
    if (!practical(item.field) || !fields.has(item.field)) throw new ProfileError(502, "AI_UNSUPPORTED_EVIDENCE");
    for (const quote of [item.actionQuote, item.methodQuote, item.outcomeQuote]) if (quote) validateEvidence({ field: item.field, quote });
    if (item.outcomeType === "OBSERVED" && !item.outcomeQuote.trim()) throw new ProfileError(502, "AI_UNSUPPORTED_EVIDENCE");
    if (item.outcomeType === "OBSERVED" && !/\p{L}/u.test(item.outcomeQuote)) throw new ProfileError(502, "AI_UNSUPPORTED_EVIDENCE");
    return item;
  });
  if (new Set(contributions.map(item => item.field)).size !== contributions.length || work.some(item => !contributions.some(contribution => contribution.field === item.field))) throw new ProfileError(502, "AI_INVALID_RESPONSE");
  const actions = contributions.filter(item => item.actionQuote.trim());
  const methods = actions.filter(item => item.methodQuote.trim());
  const outcomes = methods.filter(item => item.outcomeType === "OBSERVED" && item.outcomeQuote.trim());
  const specificityCap = !actions.length ? 0 : !methods.length ? 1 : !outcomes.length ? 2 : outcomes.length / Math.max(1, work.length) < .8 ? 3 : 4;
  const claimed = atsClaimedSkills(resume), seenSkills = new Set<string>();
  const skillEvidence = parsed.skillEvidence.map(item => {
    const canonical = normalizeAtsText(item.skill);
    if (!claimed.some(skill => normalizeAtsText(skill.term) === canonical) || seenSkills.has(canonical)) throw new ProfileError(502, "AI_UNSUPPORTED_EVIDENCE");
    seenSkills.add(canonical);
    const evidence = item.evidence.map(validateEvidence);
    if (evidence.some(source => !practical(source.field))) throw new ProfileError(502, "AI_UNSUPPORTED_EVIDENCE");
    if (item.status === "UNSUPPORTED" && evidence.length) throw new ProfileError(502, "AI_UNSUPPORTED_EVIDENCE");
    if (item.status !== "UNSUPPORTED" && (!evidence.length || evidence.some(source => !contributions.some(contribution => contribution.field === source.field && contribution.actionQuote.trim() && (item.status === "PARTIAL" || contribution.methodQuote.trim()))))) throw new ProfileError(502, "AI_UNSUPPORTED_EVIDENCE");
    return { ...item, evidence };
  });
  if (seenSkills.size !== claimed.length) throw new ProfileError(502, "AI_INVALID_RESPONSE");
  const criteria = parsed.criteria.map(criterion => {
    const evidence = criterion.evidence.map(validateEvidence);
    if (criterion.rating > 0 && !evidence.length) throw new ProfileError(502, "AI_UNSUPPORTED_EVIDENCE");
    if (criterion.id === "specificity" && criterion.rating > 0 && !evidence.some(item => practical(item.field))) throw new ProfileError(502, "AI_UNSUPPORTED_EVIDENCE");
    if (criterion.id === "positioning" && criterion.rating > 0 && (!evidence.some(item => item.field === "title") || !evidence.some(item => practical(item.field)))) throw new ProfileError(502, "AI_UNSUPPORTED_EVIDENCE");
    if (criterion.id === "writing" && criterion.rating > 0 && evidence.every(item => item.field.startsWith("contact."))) throw new ProfileError(502, "AI_UNSUPPORTED_EVIDENCE");
    // Each higher band requires source passages for the action, method and
    // observed outcome. Dates, token counts and isolated metrics earn no bonus.
    const rating = criterion.id === "specificity" ? Math.min(criterion.rating, specificityCap) : criterion.id === "positioning" && !methods.length ? Math.min(criterion.rating, 1) : criterion.rating;
    const reason = rating < criterion.rating ? (language === "fr" ? "Note limitée par les preuves disponibles d’action, de méthode ou de résultat observé. " : "Rating limited by the available evidence of action, method or observed outcome. ") + criterion.reason : criterion.reason;
    return { ...criterion, rating, reason, evidence };
  });
  const issues = parsed.issues.flatMap((candidate, index) => {
    const parsedIssue = atsReviewIssueSchema.safeParse(candidate);
    if (!parsedIssue.success) return [];
    const issue = parsedIssue.data;
    let evidence: AtsEvidence;
    try { evidence = validateEvidence({ field: issue.field, quote: issue.quote }); }
    catch { return []; } // Drop unverified suggestions rather than fail the review.
    const original = fields.get(issue.field)!;
    const numbers = new Set(original.match(/\d+(?:[.,]\d+)?/g) || []);
    const addsNumbers = (issue.proposedText.match(/\d+(?:[.,]\d+)?/g) || []).some(number => !numbers.has(number));
    const links = issue.proposedText.match(/https?:\/\/\S+|[^\s@]+@[^\s@]+\.[^\s@]+/g) || [];
    const writable = issue.field === "title" || /^summary\.\d+$/.test(issue.field) || /^(experiences|educations|projects|certifications)\.\d+\.description$/.test(issue.field);
    const safeProposal = writable && issue.proposedText.trim() && !addsNumbers && links.every(link => original.includes(link));
    return [{ id: `semantic-${index}`, category: "CONTENT" as const, severity: issue.severity, title: issue.title, reason: issue.reason, suggestion: issue.suggestion, field: issue.field, evidence: [evidence], ...(safeProposal ? { proposedText: issue.proposedText.trim() } : {}) }];
  });
  return { status: "COMPLETE", criteria, issues, contributions, skillEvidence };
}

/** The normal ATS review must work with text-generation models too.
 * Do not send a large tool/function schema to the provider: the provider's
 * structured-output support is unrelated to its ability to answer questions.
 * All scores and citations are validated *after* parsing, on this server. */
export async function reviewAtsContent(resume: EditorResume, language: "fr" | "en", model: LanguageModel, signal?: AbortSignal): Promise<SemanticReview> {
  const fields = atsEvidence(resume).filter(item => !item.field.startsWith("contact."));
  if (fields.reduce((sum, field) => sum + field.quote.length, 0) > 70_000) throw new ProfileError(413, "ATS_REVIEW_TOO_LARGE");
  // At most two attempts; retry only recoverable format/evidence errors.
  let correction = "";
  // Never send the rejected response back as instructions or log private CV text.
  for (let attempt = 0; attempt < 2; attempt++) {
    const abortSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(26_000)])
      : AbortSignal.timeout(26_000);
    try {
      const { text } = await generateText({
        model, maxRetries: 0, maxTokens: 8_000, temperature: 0, abortSignal,
        system: atsEvidenceReviewSystemPrompt() + `\nReturn exactly ONE JSON object, not Markdown or commentary, with keys: skillEvidence, contributions, criteria, issues. All arrays are required. Each item must have exactly the fields specified in the task. Do not use null for unknown quotes; use an empty string or an empty evidence array.\n`,
        prompt: atsEvidenceReviewUserPrompt({
          language, headline: resume.title, visibleFields: fields, claimedSkills: atsClaimedSkills(resume),
          requiredContributionFields: atsWorkEvidence(resume).filter(item => practical(item.field)).map(item => item.field),
          ...(attempt ? { correction: { reason: `The previous JSON failed validation (${correction}). Return the full required object with exact field names and verbatim source quotations. Do not invent missing evidence.` } } : {}),
        }),
      });
      let object: unknown;
      try { object = parseAtsJsonObject(text); }
      catch { throw new ProfileError(502, "AI_INVALID_RESPONSE"); }
      return validateAtsReview(object, resume, language);
    } catch (error) {
      if (signal?.aborted) throw new ProfileError(499, "ATS_CANCELLED");
      const code = error instanceof ProfileError ? error.code : "";
      const correctable = error instanceof z.ZodError ||
        ["AI_INVALID_RESPONSE", "AI_UNSUPPORTED_EVIDENCE"].includes(code);
      if (!correctable || attempt === 1) {
        if (error instanceof z.ZodError) {
          console.warn("ATS review schema rejected", {
            issueCount: error.issues.length,
            // Only schema paths/codes: never private resume content or generated text.
            paths: error.issues.slice(0, 6).map(issue => ({ path: issue.path.join("."), code: issue.code })),
          });
          throw new ProfileError(502, "AI_INVALID_RESPONSE");
        }
        throw error;
      }
      correction = error instanceof z.ZodError
        ? error.issues.slice(0, 8).map(issue => `${issue.path.join(".") || "root"}:${issue.code}`).join(", ")
        : code;
      console.warn("ATS review validation retry", {
        attempt: attempt + 1, reason: code || "SCHEMA_INVALID",
        ...(error instanceof z.ZodError ? {
          paths: error.issues.slice(0, 6).map(issue => ({ path: issue.path.join("."), code: issue.code })),
        } : {}),
      });
    }
  }
  throw new ProfileError(502, "AI_INVALID_RESPONSE");
}
