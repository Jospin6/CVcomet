import type { CoverLetterDocument } from "@/lib/cover-letter-editor";
import { addedUnsupportedNumbers, isVisualChangeRequest, letterReviewChanges, lockLetterIdentity, unsupportedJobTerms } from "@/lib/cover-letter-ai/review";
import type { LetterEditDraft, LetterEditInput, LetterEditResult } from "../agent/state";

export function clarifyLetter(message: string): LetterEditResult {
  return { status: "clarification", message, changes: [], document: null };
}

/** Server reconstructs an allowed document; NEVER trusts the model's full snapshot. */
export function verifyLetterEdit(input: LetterEditInput, draft: LetterEditDraft): LetterEditResult {
  const before = input.document;
  const proposed = lockLetterIdentity(before, draft.document);
  const safe: CoverLetterDocument = input.targetField
    ? { ...before, [input.targetField]: proposed[input.targetField] }
    : {
        ...proposed,
        design: isVisualChangeRequest(input.instruction)
          ? { ...proposed.design, paper: before.design.paper,
              targetMarket: before.design.targetMarket,
              documentLanguage: before.design.documentLanguage,
              templateId: before.design.templateId }
          : before.design,
      };
  const evidence = input.profileFacts.map(f => f.statement);
  // Job requirements cannot be mistaken for accomplishments or candidate skills.
  if (addedUnsupportedNumbers(before, safe, evidence).length ||
      unsupportedJobTerms(safe, before, input.requirements, evidence).length) {
    return clarifyLetter(input.language === "fr"
      ? "Certaines affirmations ne sont pas étayées. Précisez les faits pour modifier la lettre."
      : "Some claims lack supporting facts. Please clarify before changing the letter.");
  }
  const diff = letterReviewChanges(before, safe);
  if (!diff.length) return clarifyLetter(input.language === "fr"
    ? "Aucune modification nécessaire. Précisez votre demande."
    : "No changes are needed. Please clarify your request.");
  return { status: "proposal", message: draft.message,
    changes: input.targetField ? [input.targetField] : diff.map(change => change.field).slice(0, 12),
    document: safe };
}
