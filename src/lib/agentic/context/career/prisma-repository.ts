/** Database-backed adapter. Imported only on the server, never by browser or pure tests. */
import prisma from "../../../../../prisma/prisma";
import { getCareerProfile } from "@/lib/career-profile/service";
import { normalizeEditorResume } from "@/lib/resume-editor";
import type { CareerContextRepository } from "./contracts.ts";

export const prismaCareerContextRepository: CareerContextRepository = {
  getProfile: (ownerId) => getCareerProfile(ownerId),
  async getResume(ownerId, id) {
    const row = await prisma.cv.findFirst({
      where: { id, conversation: { userId: ownerId } },
      select: { id: true, title: true, revision: true, summary: true,
        skills: true, experiences: true, educations: true, projects: true,
        certifications: true, languages: true, contact: true, design: true },
    });
    if (!row) return null;
    return { id: row.id, revision: row.revision,
      ...normalizeEditorResume(row as unknown as Record<string, unknown>) };
  },
  getJob: (ownerId, id) => prisma.jobOpportunity.findFirst({
    where: { id, userId: ownerId },
    select: { id: true, title: true, company: true, location: true,
      seniority: true, description: true, requiredSkills: true, preferredSkills: true },
  }),
  getApplication: (ownerId, id) => prisma.jobApplication.findFirst({
    where: { id, userId: ownerId },
    select: { id: true, cvId: true, jobId: true, coverLetterId: true,
      company: true, jobTitle: true, status: true, nextAction: true, deadline: true },
  }),
  getCoverLetter: (ownerId, id) => prisma.coverLetter.findFirst({
    where: { id, conversation: { userId: ownerId } },
    select: { id: true, revision: true, cvId: true, jobId: true, recipientName: true,
      recipientTitle: true, companyName: true, positionTitle: true,
      introduction: true, body: true, conclusion: true },
  }),
};
