import prisma from "../../../prisma/prisma";
import { ProfileError } from "@/lib/career-profile/http";

/** The application, resume, posting and letter are all ownership-scoped.
 * Application cover-letter text is supplementary context, NEVER resume evidence. */
export async function findResumeApplications(userId: string, cvId: string, applicationId?: string) {
  const cv = await prisma.cv.findFirst({ where: { id: cvId, conversation: { userId } }, select: { id: true } });
  if (!cv) throw new ProfileError(404, "RESUME_NOT_FOUND");
  return prisma.jobApplication.findMany({
    where: { userId, cvId, ...(applicationId ? { id: applicationId } : {}) },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: {
      id: true, jobTitle: true, company: true, jobId: true, coverLetterId: true,
      job: { select: { id: true, userId: true, title: true, company: true, description: true, analysis: true, updatedAt: true } },
      coverLetter: { select: {
        id: true, cvId: true, jobId: true, positionTitle: true, companyName: true,
        introduction: true, body: true, conclusion: true,
        conversation: { select: { userId: true } },
      } },
    },
    take: applicationId ? 1 : 30,
  });
}

export function linkedLetterText(letter: { introduction: string; body: string; conclusion: string | null }) {
  return [letter.introduction, letter.body, letter.conclusion].filter(Boolean).join("\n\n").trim().slice(0, 12_000);
}

export async function resumeApplicationLetter(userId: string, cvId: string, applicationId: string) {
  const applications = await findResumeApplications(userId, cvId, applicationId);
  const selected = applications.find(item => item.id === applicationId);
  if (!selected) throw new ProfileError(404, "APPLICATION_NOT_LINKED_TO_RESUME");
  const candidate = selected.coverLetter;
  const letter = candidate && candidate.conversation.userId === userId &&
    (!candidate.cvId || candidate.cvId === cvId) &&
    (!candidate.jobId || candidate.jobId === selected.jobId) ? candidate : null;
  return { application: selected, letter, letterText: letter ? linkedLetterText(letter) : "" };
}

export async function resumeApplicationContext(userId: string, cvId: string, applicationId: string) {
  const applications = await findResumeApplications(userId, cvId, applicationId);
  const selected = applications.find(item => item.id === applicationId);
  if (!selected) throw new ProfileError(404, "APPLICATION_NOT_LINKED_TO_RESUME");
  if (!selected.job || selected.job.userId !== userId || !selected.job.description?.trim())
    throw new ProfileError(422, "APPLICATION_JOB_DESCRIPTION_REQUIRED");
  const candidate = selected.coverLetter;
  const letter = candidate && candidate.conversation.userId === userId &&
    (!candidate.cvId || candidate.cvId === cvId) &&
    (!candidate.jobId || candidate.jobId === selected.jobId) ? candidate : null;
  return { application: selected, job: selected.job, letter, letterText: letter ? linkedLetterText(letter) : "" };
}
