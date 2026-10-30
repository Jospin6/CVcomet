import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import prisma from "../../../../prisma/prisma";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";
import { atsStorageScores, storedAtsReport, type AtsAnalysis } from "@/lib/career/ats";
import { assessAtsResume } from "@/lib/career/ats-service";
import { inspectAtsPdf, MAX_ATS_PDF_BYTES } from "@/lib/career/ats-pdf";
import { normalizeEditorResume, resumeContentSchema } from "@/lib/resume-editor";
import { boundedBody, ProfileError } from "@/lib/career-profile/http";
import { z } from "zod";
import { jobTextSchema } from "@/lib/career/job-schema";
import { savedJobTitle } from "@/lib/career/job-opportunities";

const input = z.object({
  cvId: z.string().uuid(),
  keywords: z.array(z.string().trim().min(1).max(100)).max(60).optional(),
  draft: resumeContentSchema.optional(),
  language: z.enum(["fr", "en"]).default("en"),
  pdf: z.string().max(Math.ceil(MAX_ATS_PDF_BYTES / 3) * 4).optional(),
  jobDescription: z.string().trim().max(50000).default("").refine(value => !value || value.length >= 100),
  jobId: z.string().uuid().optional(),
}).strict().refine(value => !value.jobId || !value.jobDescription, { message: "Choose a saved job or provide text, not both." });
export const maxDuration = 90;
const running = new Map<string, Promise<{ id: string; report: AtsAnalysis }>>();
const responseRow = (row: { id: string; issues: unknown; [key: string]: unknown }) => {
  const report = storedAtsReport(row.issues);
  return report ? { id: row.id, createdAt: row.createdAt, cvId: row.cvId, ...report } : { id: row.id, createdAt: row.createdAt, cvId: row.cvId, version: 1, legacy: true, overallScore: null };
};

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const requestedCv = new URL(req.url).searchParams.get("cvId");
    const cvId = requestedCv ? z.string().uuid().parse(requestedCv) : null;
    const rows = await prisma.atsAnalysis.findMany({
      where: { userId: user.id, ...(cvId ? { cvId } : {}) },
      orderBy: { createdAt: "desc" },
      take: cvId ? 5 : 20,
    });
    return NextResponse.json(rows.map(row => responseRow(row)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!req.headers.get("content-type")?.includes("application/json")) throw new ProfileError(415, "INVALID_TYPE");
    const body = input.parse(JSON.parse((await boundedBody(req, 8 * 1024 * 1024)).toString("utf8")));
    const cv = await prisma.cv.findFirst({ where: { id: body.cvId, conversation: { userId: user.id } } });
    if (!cv) return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    const resume = body.draft ?? normalizeEditorResume(cv);
    const job = body.jobId ? await prisma.jobOpportunity.findFirst({ where: { id: body.jobId, userId: user.id } }) : null;
    if (body.jobId && !job) throw new ProfileError(404, "JOB_NOT_FOUND");
    const jobDescription = job ? jobTextSchema.parse(job.description) : body.jobDescription;
    const targetJob = job ? { id: job.id, title: savedJobTitle(job), company: job.company, updatedAt: job.updatedAt.toISOString() } : undefined;
    let pdf: Buffer | undefined;
    if (body.pdf !== undefined) {
      pdf = Buffer.from(body.pdf, "base64");
      if (!body.pdf || pdf.toString("base64") !== body.pdf) throw new ProfileError(400, "INVALID_FILE");
      if (pdf.length > MAX_ATS_PDF_BYTES) throw new ProfileError(413, "TOO_LARGE");
    }
    const fingerprint = createHash("sha256").update(JSON.stringify({ version: 2, userId: user.id, cvId: cv.id, resume, keywords: body.keywords, language: body.language, jobDescription, targetJob, pdf: pdf ? createHash("sha256").update(pdf).digest("hex") : null, day: new Date().toISOString().slice(0, 10) })).digest("hex");
    const recent = await prisma.atsAnalysis.findMany({ where: { userId: user.id, cvId: cv.id }, orderBy: { createdAt: "desc" }, take: 10 });
    const cached = recent.find(row => { const report = storedAtsReport(row.issues); return report?.fingerprint === fingerprint && report.review.status === "COMPLETE" && report.jobMatch.status !== "UNAVAILABLE"; });
    if (cached) return NextResponse.json(responseRow(cached), { headers: { "Cache-Control": "no-store" } });
    let operation = running.get(fingerprint);
    if (!operation) {
      operation = (async () => {
        const document = pdf ? await inspectAtsPdf(pdf, resume, body.language) : undefined;
        const report = await assessAtsResume({ userId: user.id, resume, keywords: body.keywords, language: body.language, document, jobDescription, jobAnalysis: job?.analysis });
        if (targetJob) report.targetJob = targetJob;
        report.fingerprint = fingerprint;
        const saved = await prisma.atsAnalysis.create({ data: { ...atsStorageScores(report), userId: user.id, cvId: cv.id, strengths: report.strengths, issues: { kind: "ATS_REPORT_V2", report } as unknown as Prisma.InputJsonValue } });
        return { id: saved.id, report };
      })();
      running.set(fingerprint, operation);
    }
    try {
      const result = await operation;
      return NextResponse.json({ id: result.id, ...result.report }, { headers: { "Cache-Control": "no-store" } });
    } finally { if (running.get(fingerprint) === operation) running.delete(fingerprint); }
  } catch (error) { return apiError(error); }
}
