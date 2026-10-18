import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../../../../prisma/prisma";
import { requireUser } from "@/lib/career/auth-user";
import { requireFeature } from "@/lib/career/entitlements";
import { apiError } from "@/lib/career/api";
import { analyzeJobDescription, matchJob } from "@/lib/career/job-match";
import { getCareerProfile } from "@/lib/career-profile/service";
import { reserveProfileAI } from "@/lib/career-profile/ai";
import { ProfileError, profileJson } from "@/lib/career-profile/http";
import { jobTextSchema, jobSourceSchema } from "@/lib/career/job-schema";
import { normalizeJobText } from "@/lib/career/job-input";
import { normalizeEditorResume } from "@/lib/resume-editor";

export const runtime = "nodejs";
export const maxDuration = 60;
const input = z.object({ text: jobTextSchema, source: jobSourceSchema.default({}), confirmed: z.literal(true), cvId: z.string().uuid().optional(), language: z.enum(["fr", "en"]).default("en") }).strict();
const inFlight = new Map<string, Promise<Prisma.JobMatchGetPayload<{ include: { job: true } }>>>();
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const id = new URL(req.url).searchParams.get("id");
    if (id) {
      const match = await prisma.jobMatch.findFirst({ where: { id, userId: user.id }, include: { job: { include: { applications: { where: { userId: user.id } }, coverLetters: { select: { id: true, conversationId: true } } } }, tailoredCv: { select: { id: true, title: true } } } });
      if (!match) throw new ProfileError(404, "NOT_FOUND");
      return NextResponse.json(match, { headers: { "Cache-Control": "no-store" } });
    }
    const saved = await prisma.jobMatch.findMany({ where: { userId: user.id }, select: { id: true, overallScore: true, result: true, createdAt: true, job: { select: { id: true, title: true, company: true } } }, orderBy: { createdAt: "desc" }, take: 20 });
    return NextResponse.json(saved.map(({ result, ...item }) => ({ ...item, overallScore: result ? item.overallScore : null })), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = input.parse(await profileJson(req));
    await requireFeature(user.id, "JOB_MATCH");
    const cv = body.cvId ? await prisma.cv.findFirst({ where: { id: body.cvId, conversation: { userId: user.id } } }) : null;
    if (body.cvId && !cv) throw new ProfileError(404, "RESUME_NOT_FOUND");
    const profile = await getCareerProfile(user.id);
    const resume = cv ? normalizeEditorResume(cv as unknown as Record<string, unknown>) : undefined;
    const description = normalizeJobText(body.text);
    jobTextSchema.parse(description);
    const fingerprint = createHash("sha256").update(JSON.stringify({ version: 1, userId: user.id, description, original: body.source.originalText || body.text, source: body.source, language: body.language, profile, resume, cvId: cv?.id })).digest("hex");
    const cached = await prisma.jobMatch.findUnique({ where: { fingerprint }, include: { job: true } });
    if (cached) return NextResponse.json({ ...cached, reused: true });
    if (inFlight.has(fingerprint)) return NextResponse.json(await inFlight.get(fingerprint));
    const operation = (async () => {
      await reserveProfileAI(user.id);
      const analysis = await analyzeJobDescription(description, undefined, body.language);
      const result = matchJob(profile, analysis, resume);
      return prisma.$transaction(async tx => {
      const job = await tx.jobOpportunity.create({ data: { userId: user.id, title: analysis.title, company: analysis.company || null, location: analysis.location || null, seniority: analysis.seniority || null,
        description, originalText: body.source.originalText || body.text, sourceUrl: body.source.url, sourceType: body.source.type, sourceName: body.source.name,
        analysis: analysis as unknown as Prisma.InputJsonValue, responsibilities: analysis.responsibilities, requiredSkills: analysis.requiredSkills, preferredSkills: analysis.preferredSkills, technologies: analysis.technologies, education: analysis.education, experience: analysis.experience, keywords: analysis.keywords } });
      return tx.jobMatch.create({ data: { userId: user.id, jobId: job.id, cvId: cv?.id, fingerprint, overallScore: result.overallScore, skillScore: result.skillScore, keywordScore: result.keywordScore, experienceScore: result.experienceScore, educationScore: result.educationScore, matchedSkills: result.matchedSkills, missingSkills: result.missingSkills, unverifiedSkills: result.unverifiedSkills, recommendations: result.recommendations, result: result as unknown as Prisma.InputJsonValue }, include: { job: true } });
      });
    })();
    inFlight.set(fingerprint, operation);
    try { return NextResponse.json(await operation, { status: 201 }); }
    finally { inFlight.delete(fingerprint); }
  } catch (error) { return apiError(error); }
}
