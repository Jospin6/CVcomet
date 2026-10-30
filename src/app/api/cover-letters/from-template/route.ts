import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "../../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
import { ProfileError, profileErrorResponse, profileJson } from "@/lib/career-profile/http";
import { catalogById } from "@/lib/template-catalog";
import { coverLetterDesignSchema } from "@/lib/cover-letter-editor";
import { normalizeEditorResume } from "@/lib/resume-editor";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";

const input = z.object({ templateId: z.string().max(160), cvId: z.string().uuid(), jobId: z.string().uuid().optional(), applicationId: z.string().uuid().optional() }).strict();
export async function POST(req: Request) {
  try {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new ProfileError(401, "UNAUTHORIZED");
    const body = input.parse(await profileJson(req));
    const preset = catalogById.get(body.templateId);
    if (!preset || preset.type !== "COVER_LETTER") throw new ProfileError(400, "INVALID_TEMPLATE");
    const application = body.applicationId ? await prisma.jobApplication.findFirst({ where: { id: body.applicationId, userId: actor.id } }) : null;
    if (body.applicationId && !application) throw new ProfileError(404, "APPLICATION_NOT_FOUND");
    const effectiveJobId = body.jobId ?? application?.jobId ?? undefined;
    const [cv, job] = await Promise.all([
      prisma.cv.findFirst({ where: { id: body.cvId, conversation: { userId: actor.id } } }),
      effectiveJobId ? prisma.jobOpportunity.findFirst({ where: { id: effectiveJobId, userId: actor.id } }) : null,
    ]);
    if (!cv) throw new ProfileError(404, "CV_NOT_FOUND");
    if (effectiveJobId && !job) throw new ProfileError(404, "JOB_NOT_FOUND");
    if (application && ((application.jobId && application.jobId !== effectiveJobId) || (application.cvId && application.cvId !== cv.id))) throw new ProfileError(409, "APPLICATION_CONTEXT_MISMATCH");
    const normalized = normalizeEditorResume(cv as unknown as Record<string, unknown>);
    const design = coverLetterDesignSchema.parse({ accent: preset.accent, font: preset.font, paper: preset.paper, headerStyle: preset.layout === "classic" ? "classic" : preset.layout === "minimal" ? "minimal" : "accent", targetMarket: normalized.design.targetMarket, documentLanguage: normalized.design.documentLanguage });
    const letter = await prisma.$transaction(async tx => {
      const created = await tx.coverLetter.create({ data: {
        recipientName: "", recipientTitle: "", companyName: job?.company || application?.company || "", positionTitle: job?.title || application?.jobTitle || "",
        introduction: "", body: "", conclusion: "", senderName: normalized.contact.name, senderEmail: normalized.contact.email,
        senderPhone: normalized.contact.phone, senderAddress: normalized.contact.city, sendertitle: cv.title,
        cvId: cv.id, ...(job ? { jobId: job.id } : {}), design, conversation: { create: { userId: actor.id, title: job?.title || application?.jobTitle || preset.name, content: "Editable letter created with reviewed template; no AI-generated claims." } },
      }, select: { id: true, updatedAt: true } });
      if (application) await tx.jobApplication.update({ where: { id: application.id }, data: { cvId: cv.id, jobId: job?.id ?? application.jobId, coverLetterId: created.id, cvSnapshot: { id: cv.id, title: cv.title, revision: cv.revision }, coverLetterSnapshot: { id: created.id, updatedAt: created.updatedAt.toISOString() } } });
      return created;
    });
    return NextResponse.json({ id: letter.id, applicationId: application?.id || null }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return profileErrorResponse(error); }
}
