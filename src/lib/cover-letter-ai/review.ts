import type { CoverLetterDocument } from "../cover-letter-editor";

export type LetterChange = { field: string; before: string; after: string };
export const letterIdentityFields = [
  "recipientName", "recipientTitle", "companyName", "companyAddress", "positionTitle",
  "senderName", "senderAddress", "senderEmail", "senderPhone", "sendertitle",
] as const;
export const letterTextFields = ["introduction", "body", "conclusion"] as const;

/** No model-produced sender, employer, position, or recipient metadata may be written. */
export function lockLetterIdentity(before: CoverLetterDocument, proposed: CoverLetterDocument): CoverLetterDocument {
  const value = { ...proposed };
  for (const field of letterIdentityFields) value[field] = before[field];
  return value;
}

export function isVisualChangeRequest(text: string): boolean {
  return /\b(?:design|styles?|layout|fonts?|colou?rs?|blue|green|red|black|navy|bleu(?:e|s|es)?|vert(?:e|s|es)?|rouge(?:s)?|noir(?:e|s|es)?|accent|alignment|padding|spacing|margins?|visual|typography|bold|italic|underline|format(?:ting)?|tailles?|couleurs?|polices?|marges?|espacement|alignement|gras|italique|soulign\w*|mise en page|présentation|typographie)\b/i.test(text);
}

/** Strict bound on new quantified claims; job ads NEVER count as evidence. */
export function addedUnsupportedNumbers(before: CoverLetterDocument, after: CoverLetterDocument, evidenceStatements: readonly string[]): string[] {
  const supported = new Set([before.introduction, before.body, before.conclusion, ...evidenceStatements].flatMap(value => value.match(/\d+(?:[.,]\d+)*/g) ?? []));
  return [...new Set(letterTextFields.flatMap(field => (after[field].match(/\d+(?:[.,]\d+)*/g) ?? []).filter(value => !supported.has(value))))];
}

/** Changes are bounded and are rendered as escaped text by React. */
export function letterReviewChanges(before: CoverLetterDocument, after: CoverLetterDocument): LetterChange[] {
  const textChanges = letterTextFields.filter(field => before[field] !== after[field]).map(field => ({ field, before: before[field].slice(0, 12000), after: after[field].slice(0, 12000) }));
  const designChanges = (Object.keys(before.design) as Array<keyof CoverLetterDocument["design"]>)
    .filter(key => JSON.stringify(before.design[key]) !== JSON.stringify(after.design[key]))
    .map(key => ({ field: "design." + key, before: String(JSON.stringify(before.design[key])).slice(0, 1200), after: String(JSON.stringify(after.design[key])).slice(0, 1200) }));
  return [...textChanges, ...designChanges].slice(0, 20);
}

export function letterProposalIsApplicable(status: string, expiresAt: Date, baseRevision: number, currentRevision: number, now: Date) {
  return status === "PENDING" && expiresAt.getTime() > now.getTime() && baseRevision === currentRevision;
}

/** Heuristic guard only: an LLM is NOT an independent fact checker. */
export function unsupportedJobTerms(after: CoverLetterDocument, before: CoverLetterDocument, terms: readonly string[], confirmedEvidence: readonly string[]): string[] {
  const normalize = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim();
  const proposed = normalize(letterTextFields.map(field => after[field]).join(" "));
  const supported = normalize([ ...letterTextFields.map(field => before[field]), ...confirmedEvidence].join(" "));
  const has = (haystack: string, needle: string) => (" " + haystack + " ").includes(" " + needle + " ");
  return [...new Set(terms.filter(term => term.length > 1).filter(term => {
    const token = normalize(term);
    return token && has(proposed, token) && !has(supported, token);
  }))];
}
