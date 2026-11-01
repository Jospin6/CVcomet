import prisma from "../../../prisma/prisma";
import { ProfileError } from "@/lib/career-profile/http";
import { normalizeEditorResume } from "@/lib/resume-editor";
import { normalizeCoverLetter } from "@/lib/cover-letter-editor";
import { runResumeAgent } from "@/lib/agentic/agents/resume/agent/resume.agent";
import { proposeResumeAI, decideResumeAI } from "@/lib/resume-ai/proposal-service";
import { proposeCoverLetterAI, decideCoverLetterAI } from "@/lib/cover-letter-ai/proposal-service";
import { jobAnalysisSchema } from "@/lib/career/job-schema";
import { getProfileFacts } from "@/lib/career-profile/ai-facts";
import { runCoverLetterEditAgent } from "@/lib/agentic/agents/cover-letter/agent/cover-letter.agent";

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
  const evidence = await getProfileFacts(userId, 50);
  if (kind === "resume") {
    if (!app.cvId) throw new ProfileError(409, "RESUME_REQUIRED");
    const cv = await prisma.cv.findFirst({ where: { id: app.cvId, conversation: { userId } } });
    if (!cv) throw new ProfileError(404, "RESUME_NOT_FOUND");
    const document = normalizeEditorResume(cv as unknown as Record<string, unknown>);
    const { object, document: suggested } = await runResumeAgent({ actorId: userId, input: {
      document, instruction, language, profileFacts: evidence,
      linkedJobAdvert: app.job ? { title: app.job.title, description: app.job.description,
        requiredSkills: app.job.requiredSkills, preferredSkills: app.job.preferredSkills } : null,
    } });
    if (object.status !== "applied" || !suggested) return { status: "clarification" as const, kind, message: object.message, changes: [] };
    const proposal = await proposeResumeAI({ userId, cvId: cv.id, revision: cv.revision,
      current: document, edited: suggested, edits: object.edits, message: object.message, summary: object.summary,
      evidence, instruction });
    return { status: "proposal" as const, kind, documentId: cv.id, message: object.message, changes: object.summary, ...proposal };
  }
  if (!app.coverLetterId) throw new ProfileError(409, "LETTER_REQUIRED");
  const letter = await prisma.coverLetter.findFirst({ where: { id: app.coverLetterId, conversation: { userId } }, include: { job: true } });
  if (!letter) throw new ProfileError(404, "LETTER_NOT_FOUND");
  if (letter.job && letter.job.userId !== userId) throw new ProfileError(403, "JOB_NOT_AUTHORIZED");
  if (app.jobId && letter.jobId && app.jobId !== letter.jobId) throw new ProfileError(409, "APPLICATION_CONTEXT_MISMATCH");
  const document = normalizeCoverLetter(letter as unknown as Record<string, unknown>);
  const parsed = jobAnalysisSchema.safeParse(letter.job?.analysis ?? app.job?.analysis);
  const requirements = parsed.success ? parsed.data.requirements.filter(item => item.category === "TECHNICAL").flatMap(item => item.terms) : [];
  const result = await runCoverLetterEditAgent({
    actorId: userId,
    input: {
      document, instruction, language, profileFacts: evidence, requirements,
      jobTarget: letter.job ? { title: letter.job.title, company: letter.job.company || "",
        description: letter.job.description } : app.job ? { title: app.job.title,
        company: app.job.company || "", description: app.job.description } : null,
    },
  });
  if (result.status === "clarification" || !result.document) {
    return { status: "clarification" as const, kind,
      message: result.message, changes: [] };
  }
  const proposal = await proposeCoverLetterAI({ userId, letterId: letter.id, revision: letter.revision,
    before: document, after: result.document, message: result.message, changes: result.changes, evidence, requirements });
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
