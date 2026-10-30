import { generateObject } from "ai";
import { z } from "zod";
import prisma from "../../../prisma/prisma";
import { getAIModel } from "@/lib/ai/model";
import { factualRules, reserveProfileAI } from "@/lib/career-profile/ai";
import { ProfileError, profileAIError } from "@/lib/career-profile/http";
import { normalizeEditorResume } from "@/lib/resume-editor";
import { normalizeCoverLetter, coverLetterContentSchema, coverLetterDesignSchema } from "@/lib/cover-letter-editor";
import { generateResumeConversation } from "@/lib/resume-conversation-ai";
import { proposeResumeAI, decideResumeAI } from "@/lib/resume-ai/proposal-service";
import { proposeCoverLetterAI, decideCoverLetterAI } from "@/lib/cover-letter-ai/proposal-service";
import { lockLetterIdentity, isVisualChangeRequest } from "@/lib/cover-letter-ai/review";
import { marketPrompt } from "@/lib/career-localization/markets";
import { jobAnalysisSchema } from "@/lib/career/job-schema";

const output = z.object({ message: z.string().min(1).max(1000), changes: z.array(z.string().max(500)).max(12), document: coverLetterContentSchema.extend({ design: coverLetterDesignSchema }) }).strict();
export type DraftKind = "resume" | "letter";

/** Server-owned context, never trust an application / CV / letter ID supplied by the model. */
async function ownedApplication(userId: string, id: string) {
  const application = await prisma.jobApplication.findFirst({ where: { id, userId }, include: { job: true } });
  if (!application) throw new ProfileError(404, "APPLICATION_NOT_FOUND");
  // Protect against invalid legacy associations even when the application row is owned.
  if (application.job && application.job.userId !== userId) throw new ProfileError(403, "JOB_NOT_AUTHORIZED");
  return application;
}
export async function proposeApplicationDraft(userId: string, applicationId: string, kind: DraftKind, instruction: string, language: "fr" | "en") {
  const app = await ownedApplication(userId, applicationId);
  const evidence = await prisma.careerEvidence.findMany({ where: { userId, status: "CONFIRMED" }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, revision: true, kind: true, statement: true, sourceLabel: true } });
  if (kind === "resume") {
    if (!app.cvId) throw new ProfileError(409, "RESUME_REQUIRED");
    const cv = await prisma.cv.findFirst({ where: { id: app.cvId, conversation: { userId } } });
    if (!cv) throw new ProfileError(404, "RESUME_NOT_FOUND");
    const document = normalizeEditorResume(cv as unknown as Record<string, unknown>);
    await reserveProfileAI(userId, "RESUME_EDIT");
    const { object, document: suggested } = await generateResumeConversation({ document, instruction, language,
      confirmedEvidence: evidence.map(row => ({ kind: row.kind, statement: row.statement, sourceLabel: row.sourceLabel })),
      linkedJobAdvert: app.job ? { title: app.job.title, description: app.job.description, requiredSkills: app.job.requiredSkills, preferredSkills: app.job.preferredSkills } : null });
    if (object.status !== "applied" || !suggested) return { status: "clarification" as const, kind, message: object.message, changes: [] };
    const proposal = await proposeResumeAI({ userId, cvId: cv.id, revision: cv.revision,
      current: document, edited: suggested, edits: object.edits, message: object.message, summary: object.summary,
      evidence, instruction });
    return { status: "proposal" as const, kind, documentId: cv.id, message: object.message, changes: object.summary, ...proposal };
  }
  if (!app.coverLetterId) throw new ProfileError(409, "LETTER_REQUIRED");
  const letter = await prisma.coverLetter.findFirst({ where: { id: app.coverLetterId, conversation: { userId } }, include: { job: true } });
  if (!letter) throw new ProfileError(404, "LETTER_NOT_FOUND");
  const document = normalizeCoverLetter(letter as unknown as Record<string, unknown>);
  const parsed = jobAnalysisSchema.safeParse(letter.job?.analysis);
  const requirements = parsed.success ? parsed.data.requirements.filter(item => item.category === "TECHNICAL").flatMap(item => item.terms) : [];
  await reserveProfileAI(userId, "COVER_LETTER");
  let result;
  try {
    result = await generateObject({ model: await getAIModel(), schema: output, temperature: 0, maxTokens: 4500, maxRetries: 1, abortSignal: AbortSignal.timeout(45000),
      system: factualRules + "\n" + marketPrompt(document.design.targetMarket, document.design.documentLanguage, language) + `
You are editing a candidate's cover letter. Propose the full updated document but do not invent any degree, experience, company information, results, metrics, technologies, motivation or skill. The posting lists requirements, NOT candidate qualifications. Use only candidate evidence explicitly confirmed by its owner to add new claims. Old document content may be reworded without changing factual scope. Never change sender, recruiter, employer, position or document identity fields. Keep document language, target market and paper unchanged; only make visual changes on explicit request. If evidence is missing, make no unsupported claims and ask for clarification. The proposal is for review, not yet applied.`,
      prompt: JSON.stringify({ instruction, document, job: letter.job ? { title: letter.job.title, company: letter.job.company, description: letter.job.description } : app.job ? { title: app.job.title, company: app.job.company, description: app.job.description } : null, confirmedEvidence: evidence.map(row => ({ statement: row.statement, kind: row.kind, sourceLabel: row.sourceLabel })) }),
    });
  } catch (error) { throw profileAIError(error); }
  const proposed = normalizeCoverLetter(result.object.document);
  const edited = lockLetterIdentity(document, isVisualChangeRequest(instruction) ? { ...proposed, design: { ...proposed.design, targetMarket: document.design.targetMarket, documentLanguage: document.design.documentLanguage, paper: document.design.paper } } : { ...proposed, design: document.design });
  const proposal = await proposeCoverLetterAI({ userId, letterId: letter.id, revision: letter.revision,
    before: document, after: edited, message: result.object.message, changes: result.object.changes, evidence, requirements });
  return { ...proposal, kind, documentId: letter.id };
}

export async function decideApplicationDraft(userId: string, applicationId: string, kind: DraftKind, proposalId: string, action: "accept" | "discard") {
  const app = await ownedApplication(userId, applicationId);
  const documentId = kind === "resume" ? app.cvId : app.coverLetterId;
  if (!documentId) throw new ProfileError(409, "DOCUMENT_REQUIRED");
  const owned = kind === "resume" ? await prisma.cv.findFirst({ where: { id: documentId, conversation: { userId } }, select: { id: true } }) : await prisma.coverLetter.findFirst({ where: { id: documentId, conversation: { userId } }, select: { id: true } });
  if (!owned) throw new ProfileError(404, "DOCUMENT_NOT_FOUND");
  return kind === "resume" ? decideResumeAI(userId, documentId, proposalId, action) : decideCoverLetterAI(userId, documentId, proposalId, action);
}
