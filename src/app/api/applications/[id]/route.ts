import { NextResponse } from "next/server";import prisma from "../../../../../prisma/prisma";import { requireUser } from "@/lib/career/auth-user";import { apiError } from "@/lib/career/api";import { z } from "zod"; import { Prisma } from "@prisma/client";
const patch = z.object({
  status: z.enum(["SAVED", "APPLIED", "INTERVIEW", "TECHNICAL_INTERVIEW", "OFFER", "HIRED", "REJECTED", "WITHDRAWN"]).optional(),
  notes: z.string().max(12000).nullable().optional(),
  nextAction: z.string().max(1000).nullable().optional(),
  interviewAt: z.coerce.date().nullable().optional(),
  archived: z.boolean().optional(),
  jobId: z.string().uuid().nullable().optional(),
  cvId: z.string().uuid().nullable().optional(),
  coverLetterId: z.string().uuid().nullable().optional(),
}).strict();
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){try{const u=await requireUser();const {id}=await params;const item=await prisma.jobApplication.findFirst({where:{id,userId:u.id},include:{statusEvents:{orderBy:{createdAt:"desc"}},reminders:{orderBy:{dueAt:"asc"}},interviews:{orderBy:{scheduledAt:"asc"}},cv:{select:{id:true,title:true,revision:true,conversation:{select:{userId:true}}}},coverLetter:{select:{id:true,positionTitle:true,companyName:true,conversation:{select:{userId:true}}}},job:{select:{id:true,userId:true,title:true,company:true,description:true,sourceUrl:true,matches:{where:{userId:u.id},orderBy:{createdAt:"desc"},take:5,select:{id:true,cvId:true,overallScore:true,createdAt:true}},applicationPackets:{where:{userId:u.id},orderBy:{updatedAt:"desc"},take:5,select:{id:true,status:true,cvId:true,updatedAt:true}}}}}});if(!item)return NextResponse.json({error:"Not found"},{status:404});const { job, cv, coverLetter, ...rest } = item;
  const safeCv = cv?.conversation.userId === u.id ? { id: cv.id, title: cv.title, revision: cv.revision } : null;
  const safeLetter = coverLetter?.conversation.userId === u.id ? { id: coverLetter.id, positionTitle: coverLetter.positionTitle, companyName: coverLetter.companyName } : null;
  if (!job || job.userId !== u.id) return NextResponse.json({ ...rest, cv: safeCv, coverLetter: safeLetter, job: null });
  const { userId: _jobOwner, ...publicJob } = job;
  return NextResponse.json({ ...rest, cv: safeCv, coverLetter: safeLetter, job: publicJob });
}catch(e){return apiError(e)}}
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser();
    const { id } = await params;
    const own = await prisma.jobApplication.findFirst({ where: { id, userId: u.id } });
    if (!own) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const data = patch.parse(await req.json());
    // One application = one job. Initial linking remains possible for legacy
    // applications, but an existing job cannot be replaced or detached.
    if (data.jobId !== undefined && own.jobId && data.jobId !== own.jobId) {
      return NextResponse.json({ error: "APPLICATION_JOB_IMMUTABLE" }, { status: 409 });
    }
    // A document selected for one job can never belong to another user.
    const [job, cv, letter] = await Promise.all([
      data.jobId ? prisma.jobOpportunity.findFirst({ where: { id: data.jobId, userId: u.id }, select: { id: true } }) : null,
      data.cvId ? prisma.cv.findFirst({ where: { id: data.cvId, conversation: { userId: u.id } }, select: { id: true, title: true, revision: true } }) : null,
      data.coverLetterId ? prisma.coverLetter.findFirst({ where: { id: data.coverLetterId, conversation: { userId: u.id } }, select: { id: true, updatedAt: true, cvId: true, jobId: true } }) : null,
    ]);
    if (data.jobId && !job) return NextResponse.json({ error: "JOB_NOT_FOUND" }, { status: 404 });
    if (data.cvId && !cv) return NextResponse.json({ error: "CV_NOT_FOUND" }, { status: 404 });
    if (data.coverLetterId && !letter) return NextResponse.json({ error: "LETTER_NOT_FOUND" }, { status: 404 });
    const targetCv = data.cvId !== undefined ? data.cvId : own.cvId;
    const targetJob = data.jobId !== undefined ? data.jobId : own.jobId;
    if (letter && ((letter.cvId && letter.cvId !== targetCv) || (letter.jobId && letter.jobId !== targetJob))) {
      return NextResponse.json({ error: "LETTER_CONTEXT_MISMATCH" }, { status: 409 });
    }
    // A previously attached letter must not remain linked after the user selects a different CV or job.
    const changesContext = data.cvId !== undefined || data.jobId !== undefined;
    const storedLetter = changesContext && own.coverLetterId && data.coverLetterId === undefined
      ? await prisma.coverLetter.findFirst({ where: { id: own.coverLetterId, conversation: { userId: u.id } }, select: { cvId: true, jobId: true } }) : null;
    const clearStaleLetter = Boolean(storedLetter && ((storedLetter.cvId && storedLetter.cvId !== targetCv) || (storedLetter.jobId && storedLetter.jobId !== targetJob)));
    const changed = Boolean(data.status && data.status !== own.status);
    const { archived, ...update } = data;
    return NextResponse.json(await prisma.jobApplication.update({
      where: { id },
      data: {
        ...update,
        ...(clearStaleLetter ? { coverLetterId: null, coverLetterSnapshot: Prisma.DbNull } : {}),
        ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}),
        ...(data.cvId !== undefined ? { cvSnapshot: cv ? { id: cv.id, title: cv.title, revision: cv.revision } : Prisma.DbNull } : {}),
        ...(data.coverLetterId !== undefined ? { coverLetterSnapshot: letter ? { id: letter.id, updatedAt: letter.updatedAt.toISOString() } : Prisma.DbNull } : {}),
        ...(changed ? { statusEvents: { create: { status: data.status!, note: "Mise à jour manuelle" } } } : {}),
        ...(changed && data.status === "APPLIED" && !own.appliedAt ? { appliedAt: new Date() } : {}),
      },
    }));
  } catch (e) { return apiError(e); }
}
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){try{const u=await requireUser();const {id}=await params;const r=await prisma.jobApplication.deleteMany({where:{id,userId:u.id}});return r.count?new NextResponse(null,{status:204}):NextResponse.json({error:"Not found"},{status:404})}catch(e){return apiError(e)}}
