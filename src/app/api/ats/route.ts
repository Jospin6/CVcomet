import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import prisma from "../../../../prisma/prisma";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";
import { analyzeResume, atsStorageScores, storedAtsReport, type AtsAnalysis } from "@/lib/career/ats";
import { runAtsAgent } from "@/lib/agentic/agents/ats/agent/ats.agent";
import { inspectAtsPdf, MAX_ATS_PDF_BYTES } from "@/lib/career/ats-pdf";
import { normalizeEditorResume, resumeContentSchema } from "@/lib/resume-editor";
import { boundedBody, ProfileError } from "@/lib/career-profile/http";
import { resumeApplicationContext, resumeApplicationLetter } from "@/lib/career/ats-application-context";
import { z } from "zod";
import { jobTextSchema } from "@/lib/career/job-schema";
import { savedJobTitle } from "@/lib/career/job-opportunities";

const input = z.object({
  cvId: z.string().uuid(), mode: z.enum(["general", "job"]),
  draft: resumeContentSchema.optional(), language: z.enum(["fr", "en"]).default("en"),
  pdf: z.string().max(Math.ceil(MAX_ATS_PDF_BYTES / 3) * 4).optional(),
  jobId: z.string().uuid().optional(), applicationId: z.string().uuid().optional(),
  jobDescription: z.string().trim().max(50000).optional(),
  coverLetterText: z.string().trim().max(12000).optional(),
  letterApplicationId: z.string().uuid().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.mode === "general" && (value.jobId || value.applicationId || value.jobDescription)) {

    ctx.addIssue({ code: "custom", message: "General ATS assessment cannot include a job posting." });
  }
  if (value.letterApplicationId && (value.mode !== "general" || value.coverLetterText)) {
    ctx.addIssue({ code: "custom", message: "Linked letter must not be overridden." });
  }
  if (value.mode === "job" && [value.jobId, value.applicationId, value.jobDescription?.trim()].filter(Boolean).length !== 1) {
    ctx.addIssue({ code: "custom", message: "Choose exactly one application, saved posting or job description." });
  }
});
export const maxDuration = 90;
export const runtime = "nodejs";
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
      where: { userId: user.id, ...(cvId ? { cvId } : {}) }, orderBy: { createdAt: "desc" }, take: cvId ? 5 : 20,
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
    if (!cv) throw new ProfileError(404, "RESUME_NOT_FOUND");
    const resume = body.draft ?? normalizeEditorResume(cv);

    let jobDescription = "", jobAnalysis: unknown;
    let targetJob: AtsAnalysis["targetJob"];
    let linkedLetter = "";
    let letterStatus: "LINKED" | "PROVIDED" | "NOT_PROVIDED" = "NOT_PROVIDED";
    if (body.mode === "job" && body.applicationId) {
      const { job, letterText } = await resumeApplicationContext(user.id, cv.id, body.applicationId);
      if (!jobTextSchema.safeParse(job.description).success) throw new ProfileError(422, "APPLICATION_JOB_DESCRIPTION_REQUIRED");
      jobDescription = job.description;
      jobAnalysis = job.analysis;
      targetJob = { id: job.id, title: savedJobTitle(job), company: job.company, updatedAt: job.updatedAt.toISOString() };
      linkedLetter = letterText;
      letterStatus = letterText ? "LINKED" : "NOT_PROVIDED";
    } else if (body.mode === "job" && body.jobId) {
      const job = await prisma.jobOpportunity.findFirst({ where: { id: body.jobId, userId: user.id } });
      if (!job) throw new ProfileError(404, "JOB_NOT_FOUND");
      if (!jobTextSchema.safeParse(job.description).success) throw new ProfileError(422, "JOB_DESCRIPTION_REQUIRED");
      jobDescription = job.description;
      jobAnalysis = job.analysis;
      targetJob = { id: job.id, title: savedJobTitle(job), company: job.company, updatedAt: job.updatedAt.toISOString() };
    } else if (body.mode === "job") {
      if (!jobTextSchema.safeParse(body.jobDescription).success) throw new ProfileError(422, "JOB_DESCRIPTION_REQUIRED");
      jobDescription = body.jobDescription!;
    }
    if (body.mode === "general" && body.letterApplicationId) {
      const context = await resumeApplicationLetter(user.id, cv.id, body.letterApplicationId);
      linkedLetter = context.letterText;
      letterStatus = linkedLetter ? "LINKED" : "NOT_PROVIDED";
    }
    const letterText = linkedLetter || body.coverLetterText?.trim() || "";
    if (letterText && !linkedLetter) letterStatus = "PROVIDED";

    let pdf: Buffer | undefined;
    if (body.pdf !== undefined) {
      pdf = Buffer.from(body.pdf, "base64");
      if (!body.pdf || pdf.toString("base64") !== body.pdf) throw new ProfileError(400, "INVALID_FILE");
      if (pdf.length > MAX_ATS_PDF_BYTES) throw new ProfileError(413, "TOO_LARGE");
    }
    const fingerprint = createHash("sha256").update(JSON.stringify({
      version: 3, userId: user.id, cvId: cv.id, resume, language: body.language,
      mode: body.mode, applicationId: body.applicationId || null, letterApplicationId: body.letterApplicationId || null, jobDescription,
      targetJob, letterHash: letterText ? createHash("sha256").update(letterText).digest("hex") : null,
      pdf: pdf ? createHash("sha256").update(pdf).digest("hex") : null,
      day: new Date().toISOString().slice(0, 10),
    })).digest("hex");
    const recent = await prisma.atsAnalysis.findMany({ where: { userId: user.id, cvId: cv.id }, orderBy: { createdAt: "desc" }, take: 10 });
    const cached = recent.find(row => {
      const report = storedAtsReport(row.issues);
      return report?.fingerprint === fingerprint && report.review.status === "COMPLETE" &&
        (body.mode === "general" || report.jobMatch.status === "COMPLETE");
    });
    if (cached) return NextResponse.json(responseRow(cached), { headers: { "Cache-Control": "no-store" } });

    let operation = running.get(fingerprint);
    if (!operation) {
      operation = (async () => {
        const diagnostics: NonNullable<AtsAnalysis["diagnostics"]> = [];
        let document: Awaited<ReturnType<typeof inspectAtsPdf>> | undefined;
        if (pdf) {
          try { document = await inspectAtsPdf(pdf, resume, body.language); }
          catch (error) {
            // A broken PDF must not prevent deterministic CV content checks.
            diagnostics.push("PDF_UNAVAILABLE");
            console.error("ATS PDF inspection unavailable", { name: error instanceof Error ? error.name : "Unknown" });
          }
        }
        let report: AtsAnalysis;
        try {
          report = await runAtsAgent({ actorId: user.id, input: {
            resume, keywords: [], language: body.language, document, jobDescription, jobAnalysis,
          }, signal: req.signal });
        } catch (error) {
          if (req.signal.aborted) throw new ProfileError(499, "ATS_CANCELLED");
          const code = (error as { code?: unknown })?.code;
          if (["AGENT_ACCESS_DENIED", "AGENT_INVALID_IDENTITY", "AGENT_MODEL_INPUT_INVALID"].includes(String(code))) throw error;
          // Only after auth/input/ownership checks: never fabricate an AI review or job match.
          // Present the deterministic content checks as a PARTIAL result.
          console.error("ATS graph unavailable", { code: typeof code === "string" ? code : "ATS_ENGINE_UNAVAILABLE", name: error instanceof Error ? error.name : "Unknown" });
          diagnostics.push("ATS_ENGINE_UNAVAILABLE");
          report = analyzeResume(resume, [], body.language, {
            document,
            ...(body.mode === "job" ? { jobMatch: { status: "UNAVAILABLE", score: null, error: "ATS_ENGINE_UNAVAILABLE", requirements: [] } } : {}),
          });
        }
        if (targetJob) report.targetJob = targetJob;
        report.fingerprint = fingerprint;
        report.diagnostics = [...new Set([...(report.diagnostics ?? []), ...diagnostics])];
        // Never store cover-letter text or URLs in the assessment report.
        // Deterministic, non-scoring letter checks; the letter never becomes CV evidence.
        const company = targetJob?.company?.trim() || "";
        const title = targetJob?.title?.trim() || "";
        const normalizedLetter = letterText.toLocaleLowerCase().normalize("NFKC");
        report.supportingLetter = { status: letterStatus, note: letterStatus === "LINKED"
          ? "Application cover letter resolved; compared for explicit position/company mentions only."
          : letterStatus === "PROVIDED" ? "Provided cover letter checked for explicit position/company mentions only."
          : "No cover letter supplied.",
          ...(letterText ? { checks: [
            { label: "Readable cover letter text", observed: letterText.length >= 80 },
            { label: "Target position mentioned", observed: title ? normalizedLetter.includes(title.toLocaleLowerCase().normalize("NFKC")) : null },
            { label: "Target company mentioned", observed: company ? normalizedLetter.includes(company.toLocaleLowerCase().normalize("NFKC")) : null },
          ] } : {}),
        };
        const saved = await prisma.atsAnalysis.create({ data: {
          ...atsStorageScores(report), userId: user.id, cvId: cv.id, strengths: report.strengths,
          issues: { kind: "ATS_REPORT_V2", report } as unknown as Prisma.InputJsonValue,
        } });
        return { id: saved.id, report };
      })();
      running.set(fingerprint, operation);
    }
    try {
      const result = await operation;
      return NextResponse.json({ id: result.id, ...result.report }, { headers: { "Cache-Control": "no-store" } });
    } finally { if (running.get(fingerprint) === operation) running.delete(fingerprint); }
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    if (["P1001", "P1002", "P2024"].includes(String(code))) {
      console.error("ATS database unavailable", { code });
      return NextResponse.json({ error: "DATABASE_UNAVAILABLE" }, { status: 503 });
    }
    return apiError(error);
  }
}
