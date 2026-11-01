import { coverLetterSchema } from "@/helpers/schema";
import { addedUnsupportedNumbers, unsupportedJobTerms } from "@/lib/cover-letter-ai/review";
import { ProfileError } from "@/lib/career-profile/http";
import { normalizeCoverLetter } from "@/lib/cover-letter-editor";
import type { LetterCreationInput, CoverLetterDraft } from "../agent/creation-state";

/** Model-generated identity and employer metadata are ignored in favor of owner-scoped DB context. */
export function verifyLetterCreation(input: LetterCreationInput, raw: CoverLetterDraft): CoverLetterDraft {
  const validated = coverLetterSchema.shape.coverLetter.parse(raw);
  const draft = coverLetterSchema.shape.coverLetter.parse({
    ...validated,
    recipientName: "", recipientTitle: "", companyName: input.job.company || "",
    companyAddress: "", positionTitle: input.job.title,
    senderName: input.profile.name, senderEmail: input.profile.email,
    senderPhone: input.profile.phone, senderAddress: input.profile.address,
    sendertitle: input.profile.headline,
  });
  const empty = normalizeCoverLetter({});
  const candidate = normalizeCoverLetter(draft as unknown as Record<string, unknown>);
  const evidence = [input.facts];
  if (addedUnsupportedNumbers(empty, candidate, evidence).length ||
      unsupportedJobTerms(candidate, empty, input.technicalRequirements, evidence).length) {
    throw new ProfileError(422, "UNSUPPORTED_FACTS");
  }
  return draft;
}
