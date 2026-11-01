import { resumeContentSchema, type EditorResume } from "@/lib/resume-editor";
import {
  applyResumeConversationEdits,
  resumeConversationChanges,
  resumeConversationSchemaFor,
  type ResumeConversationResult,
} from "@/lib/resume-conversation";
import { reviewChanges, unsupportedNumericClaims } from "@/lib/resume-ai/review";
import type { ResumeAgentDraft, ResumeAgentInput, ResumeAgentResult } from "../agent/state";

export function clarifyResume(message: string): ResumeAgentResult {
  return { object: { status: "clarification", message, summary: [], edits: [] }, document: null };
}

/** Defense in depth: never trust paths or edited snapshots returned by the model.
 * Reapply only validated operations against the owner-scoped document snapshot. */
export function verifyResumeEdit(input: ResumeAgentInput, draft: ResumeAgentDraft): ResumeAgentResult {
  const candidate = resumeConversationSchemaFor(input.document).parse(draft.object);
  if (candidate.status === "clarification") return clarifyResume(candidate.message);

  // Focused mode is intentionally limited to ONE existing document field.
  const edits = input.targetField
    ? candidate.edits.filter(edit => edit.type === "setField" && edit.path === input.targetField)
    : candidate.edits;
  if (input.targetField && edits.length === 0) return clarifyResume(input.language === "fr"
    ? "Aucune modification sûre de cette sélection. Précisez votre demande."
    : "No safe change to this selection. Please clarify your request.");
  if (!edits.length) return clarifyResume(candidate.message);

  const result = resumeContentSchema.parse(applyResumeConversationEdits(input.document, edits));
  // Numbers must already occur in candidate-controlled sources. Advert requirements
  // are NOT evidence that a candidate achieved them.
  const { design: _design, ...candidateContent } = input.document;
  void _design;
  const facts = Array.isArray(input.profileFacts) ? input.profileFacts
    .filter(row => typeof row === "object" && row !== null && "statement" in row && typeof row.statement === "string")
    .map(row => (row as { statement: string }).statement) : [];
  if (unsupportedNumericClaims(edits, [JSON.stringify(candidateContent), input.instruction, ...facts]).length) {
    return clarifyResume(input.language === "fr"
      ? "Certaines affirmations chiffrées ne sont pas vérifiables. Précisez les faits avant de modifier le CV."
      : "Some numerical claims cannot be verified. Provide the supporting facts before editing.");
  }
  if (!reviewChanges(input.document, result, edits).length) return clarifyResume(input.language === "fr"
    ? "Le document correspond déjà à cette demande."
    : "The document already matches this request.");

  const object: ResumeConversationResult = {
    status: "applied",
    message: candidate.message,
    summary: input.targetField ? resumeConversationChanges(edits) : candidate.summary,
    edits,
  };
  return { object, document: result };
}
