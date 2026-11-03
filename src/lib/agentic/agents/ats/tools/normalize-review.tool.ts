/**
 * Align harmless JSON shape variations across AI providers before Zod validation.
 * This never invents ratings, skills, quotes or evidence. Missing meaningful
 * fields remain missing and must be rejected by the strict validator.
 */
type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord | null => value && typeof value === "object" && !Array.isArray(value)
  ? value as JsonRecord : null;
const array = (value: unknown): unknown[] | undefined => Array.isArray(value) ? value : undefined;
const first = (value: JsonRecord, ...names: string[]) => names.map(name => value[name]).find(item => item !== undefined);
const string = (value: unknown): unknown => typeof value === "string" ? value.trim() : value;
const upper = (value: unknown): unknown => typeof value === "string" ? value.toUpperCase().trim() : value;
const lower = (value: unknown): unknown => typeof value === "string" ? value.toLowerCase().trim() : value;

const evidence = (value: unknown): unknown => array(value)?.map(item => {
  const r = record(item);
  return r ? { field: first(r, "field", "path"), quote: first(r, "quote", "text") } : item;
}) ?? value;

export function normalizeAtsReviewShape(value: unknown): unknown {
  const root = record(value);
  if (!root) return value;
  const result: JsonRecord = {};
  const rawSkills = first(root, "skillEvidence", "skill_evidence");
  result.skillEvidence = array(rawSkills)?.map(item => {
    const r = record(item);
    if (!r) return item;
    const status = upper(first(r, "status", "assessment"));
    const citations = first(r, "evidence", "sources");
    return {
      skill: first(r, "skill", "term"), status,
      evidence: citations == null && status === "UNSUPPORTED" ? [] : evidence(citations),
    };
  }) ?? rawSkills;
  const rawContributions = first(root, "contributions", "workContributions");
  result.contributions = array(rawContributions)?.map(item => {
    const r = record(item);
    if (!r) return item;
    const actionQuote = first(r, "actionQuote", "action_quote");
    const methodQuote = first(r, "methodQuote", "method_quote");
    const outcomeQuote = first(r, "outcomeQuote", "outcome_quote");
    const outcomeType = upper(first(r, "outcomeType", "outcome_type"));
    return {
      field: first(r, "field", "path"),
      actionQuote: actionQuote == null ? "" : string(actionQuote),
      methodQuote: methodQuote == null ? "" : string(methodQuote),
      outcomeQuote: outcomeQuote == null ? "" : string(outcomeQuote),
      outcomeType: outcomeType == null && !outcomeQuote ? "NOT_STATED" : outcomeType,
    };
  }) ?? rawContributions;
  const rawCriteria = first(root, "criteria", "rubric");
  const criterionArray = array(rawCriteria) ?? (record(rawCriteria)
    ? Object.entries(rawCriteria as JsonRecord).map(([id, item]) => ({ ...record(item), id })) : undefined);
  result.criteria = criterionArray?.map(item => {
    const r = record(item);
    if (!r) return item;
    const rawRating = first(r, "rating", "score");
    const rating = typeof rawRating === "string" && /^[0-4]$/.test(rawRating.trim()) ? Number(rawRating) : rawRating;
    const sources = first(r, "evidence", "sources");
    return {
      id: lower(r.id), rating, reason: string(first(r, "reason", "explanation")),
      evidence: sources == null && rating === 0 ? [] : evidence(sources),
    };
  }) ?? rawCriteria;
  const rawIssues = first(root, "issues", "recommendations");
  result.issues = (rawIssues == null ? [] : array(rawIssues)?.map(item => {
    const r = record(item);
    if (!r) return item;
    return {
      field: first(r, "field", "path"), severity: lower(r.severity),
      title: string(r.title), reason: string(first(r, "reason", "explanation")),
      suggestion: string(first(r, "suggestion", "action")),
      quote: first(r, "quote", "evidenceQuote"),
      proposedText: r.proposedText == null ? "" : string(r.proposedText),
    };
  }) ?? rawIssues);
  return result;
}
