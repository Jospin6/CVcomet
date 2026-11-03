import { NextResponse } from "next/server";
import prisma from "../../../../prisma/prisma";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";
import { ProfileError, profileJson } from "@/lib/career-profile/http";
import { z } from "zod";
const statuses = ["SAVED", "APPLIED", "INTERVIEW", "TECHNICAL_INTERVIEW", "OFFER", "HIRED", "REJECTED", "WITHDRAWN"] as const;
const input = z.object({ jobId:z.string().uuid().optional(),company:z.string().trim().min(1).max(300).optional(),jobTitle:z.string().trim().min(1).max(300).optional(),location:z.string().max(300).optional(),country:z.string().max(100).optional(),workMode:z.string().max(60).optional(),contractType:z.string().max(80).optional(),salary:z.string().max(200).optional(),currency:z.string().max(12).optional(),jobUrl:z.string().url().max(2048).optional().or(z.literal("")),source:z.string().max(100).optional(),status:z.enum(statuses).default("SAVED"),appliedAt:z.coerce.date().nullable().optional(),notes:z.string().max(12000).optional(),contactPerson:z.string().max(300).optional(),nextAction:z.string().max(1000).optional(),cvId:z.string().uuid().optional(),coverLetterId:z.string().uuid().optional(),reopenExisting:z.boolean().optional() }).strict();
export async function GET(req:Request){try{const u=await requireUser(),q=new URL(req.url).searchParams,p=Math.max(1,Number(q.get("page")||1)),size=Math.min(100,Math.max(1,Number(q.get("pageSize")||30))),term=q.get("q")?.slice(0,200),status=q.get("status")||undefined,archived=q.get("archived");const where={userId:u.id,...(archived==="true"?{archivedAt:{not:null}}:archived==="false"?{archivedAt:null}:{}),...(statuses.includes(status as typeof statuses[number])?{status:status as typeof statuses[number]}:{}),...(term?{OR:[{company:{contains:term,mode:"insensitive" as const}},{jobTitle:{contains:term,mode:"insensitive" as const}}]}:{})};const [items,total]=await prisma.$transaction([prisma.jobApplication.findMany({where,include:{cv:{select:{id:true,title:true}},coverLetter:{select:{id:true,conversationId:true}},statusEvents:{orderBy:{createdAt:"desc"}},reminders:{where:{completedAt:null},orderBy:{dueAt:"asc"}},interviews:{orderBy:{scheduledAt:"asc"}}},orderBy:{updatedAt:"desc"},skip:(p-1)*size,take:size}),prisma.jobApplication.count({where})]);return NextResponse.json({items,total,page:p,pageSize:size})}catch(e){return apiError(e)}}
export async function POST(req: Request) {
  try {
    const u = await requireUser();
    const b = input.parse(await profileJson(req));
    const { reopenExisting, ...createInput } = b;
    // A previously analyzed job is always looked up in the actor's own workspace.
    // This also makes the existing Job Match "Save application" action functional.
    const job = b.jobId ? await prisma.jobOpportunity.findFirst({
      where: { id: b.jobId, userId: u.id },
      select: { id: true, title: true, company: true, location: true, sourceUrl: true, description: true },
    }) : null;
    if (b.jobId && !job) throw new ProfileError(404, "JOB_NOT_FOUND");
    // A new application is a concrete CV + job-description pair.
    // Keep old incomplete applications readable for migration, but never create more.
    if (!b.cvId) throw new ProfileError(422, "APPLICATION_CV_REQUIRED");
    if (!b.jobId || !job?.description || job.description.trim().length < 100)
      throw new ProfileError(422, "APPLICATION_JOB_DESCRIPTION_REQUIRED");
    const jobTitle = (b.jobTitle || job?.title || "").trim();
    const company = (b.company || job?.company || (job ? "Entreprise à préciser" : "")).trim();
    if (!company || !jobTitle) throw new ProfileError(400, "COMPANY_AND_TITLE_REQUIRED");
    const [cv, letter] = await Promise.all([
      b.cvId ? prisma.cv.findFirst({ where: { id: b.cvId, conversation: { userId: u.id } } }) : null,
      b.coverLetterId ? prisma.coverLetter.findFirst({ where: { id: b.coverLetterId, conversation: { userId: u.id } } }) : null,
    ]);
    if (b.cvId && !cv) throw new ProfileError(404, "RESUME_NOT_FOUND");
    if (b.coverLetterId && !letter) throw new ProfileError(404, "LETTER_NOT_FOUND");
    if (letter && ((letter.cvId && letter.cvId !== b.cvId) ||
      (letter.jobId && letter.jobId !== b.jobId))) {
      throw new ProfileError(409, "LETTER_CONTEXT_MISMATCH");
    }
    const existing = await prisma.jobApplication.findFirst({
      where: { userId: u.id, archivedAt: null,
        ...(job ? { jobId: job.id } : { company, jobTitle }) },
      select: { id: true, cvId: true },
    });
    if (existing) {
      if (existing.cvId !== b.cvId) throw new ProfileError(409, "APPLICATION_RESUME_MISMATCH");
      if (reopenExisting) return NextResponse.json({ id: existing.id, reused: true });
      throw new ProfileError(409, "DUPLICATE_APPLICATION");
    }
    // `reopenExisting` is an API-only flag, not a Prisma model field.
    return NextResponse.json(await prisma.jobApplication.create({
      data: {
        ...createInput, company, jobTitle, userId: u.id,
        location: b.location || job?.location || undefined,
        jobUrl: b.jobUrl || job?.sourceUrl || undefined,
        cvSnapshot: cv ? { id: cv.id, title: cv.title, revision: cv.revision } : undefined,
        coverLetterSnapshot: letter ? { id: letter.id, updatedAt: letter.updatedAt.toISOString() } : undefined,
        statusEvents: { create: { status: b.status, note: "Création" } },
      },
    }), { status: 201 });
  } catch (e) { return apiError(e); }
}
