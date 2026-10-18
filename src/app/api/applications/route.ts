import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";
import { ProfileError, profileJson } from "@/lib/career-profile/http";
import { z } from "zod";
const input = z.object({ company: z.string().trim().max(300).default(""), jobTitle: z.string().trim().max(300).default(""), location: z.string().max(300).optional(), salary: z.string().max(200).optional(), jobUrl: z.string().url().max(2048).optional().or(z.literal("")), source: z.string().max(100).optional(), status: z.enum(["SAVED", "APPLIED", "INTERVIEW", "TECHNICAL_INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"]).default("SAVED"), notes: z.string().max(12000).optional(), contactPerson: z.string().max(300).optional(), nextAction: z.string().max(1000).optional(), jobId: z.string().uuid().optional(), cvId: z.string().uuid().optional(), coverLetterId: z.string().uuid().optional() }).strict();
export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(await prisma.jobApplication.findMany({ where: { userId: user.id }, include: { job: { select: { id: true, matches: { where: { userId: user.id }, select: { id: true }, take: 1 } } }, cv: { select: { id: true, title: true } }, coverLetter: { select: { id: true, conversationId: true } } }, orderBy: { updatedAt: "desc" } }));
  } catch (error) { return apiError(error); }
}
export async function POST(req: Request) {
  try {
    const user = await requireUser(), body = input.parse(await profileJson(req));
    const job = body.jobId ? await prisma.jobOpportunity.findFirst({ where: { id: body.jobId, userId: user.id } }) : null;
    if (body.jobId && !job) throw new ProfileError(404, "NOT_FOUND");
    if (body.cvId && !await prisma.cv.findFirst({ where: { id: body.cvId, conversation: { userId: user.id } }, select: { id: true } })) throw new ProfileError(404, "RESUME_NOT_FOUND");
    if (body.coverLetterId && !await prisma.coverLetter.findFirst({ where: { id: body.coverLetterId, conversation: { userId: user.id } }, select: { id: true } })) throw new ProfileError(404, "NOT_FOUND");
    if (job) {
      const existing = await prisma.jobApplication.findFirst({ where: { userId: user.id, jobId: job.id } });
      if (existing) return NextResponse.json(existing);
    }
    const company = job?.company || body.company, jobTitle = job?.title || body.jobTitle;
    if (!jobTitle || (!job && !company)) throw new ProfileError(400, "VALIDATION");
    const letter = job && !body.coverLetterId ? await prisma.coverLetter.findFirst({ where: { jobId: job.id, conversation: { userId: user.id } }, select: { id: true } }) : null;
    return NextResponse.json(await prisma.jobApplication.create({ data: { ...body, company, jobTitle, location: job?.location || body.location, jobUrl: job?.sourceUrl || body.jobUrl || null, coverLetterId: body.coverLetterId || letter?.id, source: job ? "JOB_ANALYZER" : body.source, userId: user.id } }), { status: 201 });
  } catch (error) { return apiError(error); }
}
