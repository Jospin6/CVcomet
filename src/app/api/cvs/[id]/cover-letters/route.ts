import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "../../../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
import { jobCoverLetter } from "@/lib/career/job-documents";
import { resumeSourceJob } from "@/lib/career/resume-source-job";
import { ProfileError, profileErrorResponse, profileJson } from "@/lib/career-profile/http";

type Context = { params: Promise<{ id: string }> };
const input = z.object({ language: z.enum(["fr", "en"]).default("en"), notes: z.string().max(4000).default("") }).strict();

export async function GET(_: Request, { params }: Context) {
  try {
    const user = await getSessionUser(); if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const { id } = await params;
    const letters = await prisma.coverLetter.findMany({ where: { cvId: id, cv: { conversation: { userId: user.id } } }, orderBy: { updatedAt: "desc" }, select: { id: true, positionTitle: true, companyName: true, updatedAt: true, jobId: true } });
    return NextResponse.json(letters, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return profileErrorResponse(error); }
}

export async function POST(req: Request, { params }: Context) {
  try {
    const user = await getSessionUser(); if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const { id } = await params, body = input.parse(await profileJson(req));
    const source = await resumeSourceJob(user.id, id);
    if (!source.job) throw new ProfileError(422, "JOB_REQUIRED");
    const generated = await jobCoverLetter(user.id, { jobId: source.job.id, cvId: id, language: body.language, notes: body.notes, action: "GENERATE" });
    const saved = await jobCoverLetter(user.id, { jobId: source.job.id, cvId: id, language: body.language, notes: body.notes, action: "SAVE", draft: generated.draft });
    return NextResponse.json({ id: saved.letterId, jobId: source.job.id }, { status: 201 });
  } catch (error) { return profileErrorResponse(error); }
}
