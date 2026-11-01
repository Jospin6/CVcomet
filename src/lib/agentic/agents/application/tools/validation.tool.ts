import { CareerContractError } from "@/lib/career-os/contracts";
import type { ApplicationEmail, ApplicationPacketInput, ApplicationSuggestionInput } from "./contracts.tool";

const badInput = (): never => { throw new CareerContractError(400, "APPLICATION_AGENT_INPUT_INVALID"); };
const badSuggestion = (): never => { throw new CareerContractError(422, "SUGGESTION_REQUIRES_REVIEW"); };
const bounded = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max;

/** Restrict what a graph may receive, including user-controlled job text. */
export function assertPacketInput(input: ApplicationPacketInput): void {
  if (!input || !["en", "fr"].includes(input.language) ||
    !bounded(input.jobTitle, 240) || !input.jobTitle.trim() ||
    (input.company !== null && !bounded(input.company, 240)) ||
    (input.signer !== null && !bounded(input.signer, 160))) badInput();
}

export function assertSuggestionInput(input: ApplicationSuggestionInput): void {
  assertPacketInput(input);
  if (!bounded(input.description, 6000) ||
    !Array.isArray(input.profileFacts) || input.profileFacts.length > 50 ||
    input.profileFacts.some(s => !bounded(s, 400)) ||
    !Array.isArray(input.technicalTerms) || input.technicalTerms.length > 120 ||
    input.technicalTerms.some(s => !bounded(s, 120))) badInput();
}

/** Checks apply to graph output BEFORE it is given to the UI. A preview is never sent or saved. */
export function assertApplicationEmail(email: ApplicationEmail, kind: "initial" | "suggestion"): void {
  if (!email || !bounded(email.subject, 300) || !bounded(email.body, kind === "initial" ? 1500 : 6000) ||
    email.subject.trim().length < 3 || email.body.trim().length < 20 ||
    /[\r\n\u0000-\u001f\u007f]/.test(email.subject) ||
    /\u0000|\u007f/.test(email.body) ||
    /<\/?[a-z][^>]*>/i.test(email.body) ||
    /\bhttps?:\/\//i.test(email.body) ||
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(email.body) ||
    /(?:i (?:have )?(?:already )?(?:sent|submitted|attached)|please find attached|j['’]ai (?:déjà )?(?:envoyé|joint)|ci-joint|en pièce jointe)/i.test(email.body)) {
    badSuggestion();
  }
}

/** External submission is never an operation of this agent. */
export function verifiedSuggestion(email: ApplicationEmail | null, input: ApplicationSuggestionInput,
  verifyFacts: (email: ApplicationEmail, input: ApplicationSuggestionInput) => void): ApplicationEmail {
  if (!email) return badSuggestion();
  assertApplicationEmail(email, "suggestion");
  try { verifyFacts(email, input); } catch { return badSuggestion(); }
  return { subject: email.subject.trim(), body: email.body.trim() };
}
