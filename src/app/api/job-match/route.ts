import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../../../../prisma/prisma";
import { requireUser } from "@/lib/career/auth-user";
import { requireFeature } from "@/lib/career/entitlements";
import { apiError } from "@/lib/career/api";
import { runJobMatchAgent } from "@/lib/agentic/agents/job-match/agent/job-match.agent";
import { validateSavedJobAnalysis } from "@/lib/agentic/agents/job-match/tools/plan.tool";
import { getCareerProfile } from "@/lib/career-profile/service";
import { reserveProfileAI } from "@/lib/career-profile/ai";
import { ProfileError, profileJson } from "@/lib/career-profile/http";
import { jobTextSchema, jobSourceSchema } from "@/lib/career/job-schema";
import { normalizeJobText } from "@/lib/career/job-input";
import { normalizeEditorResume } from "@/lib/resume-editor";
import { savedJobTitle } from "@/lib/career/job-opportunities";

export const runtime = "nodejs";
export const maxDuration = 60;
const input = z.object({ text: jobTextSchema, source: jobSourceSchema.default({}), confirmed: z.literal(true), cvId: z.string().uuid().optional(), applicationId: z.string().uuid().optional(), language: z.enum(["fr", "en"]).default("en") }).strict();
const inFlight = new Map<string, Promise<Prisma.JobMatchGetPayload<{ include: { job: true } }>>>();
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const id = new URL(req.url).searchParams.get("id");
    if (id) {
      const match = await prisma.jobMatch.findFirst({ where: { id, userId: user.id }, include: { job: { include: { applications: { where: { userId: user.id } }, coverLetters: { select: { id: true, cvId: true } } } }, tailoredCv: { select: { id: true, title: true } } } });
      if (!match) throw new ProfileError(404, "NOT_FOUND");
      return NextResponse.json(match, { headers: { "Cache-Control": "no-store" } });
    }
    const saved = await prisma.jobMatch.findMany({ where: { userId: user.id }, select: { id: true, overallScore: true, result: true, createdAt: true, job: { select: { id: true, title: true, company: true } } }, orderBy: { createdAt: "desc" }, take: 20 });
    return NextResponse.json(saved.map(({ result, ...item }) => ({ ...item, overallScore: result ? item.overallScore : null })), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
/** Application-scoped analysis reuses the job already attached to the dossier.
 * Never trust a caller-supplied description or CV ID over the owned application.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = input.parse(await profileJson(req));
    await requireFeature(user.id, "JOB_MATCH");

    const application = body.applicationId
      ? await prisma.jobApplication.findFirst({
          where: { id: body.applicationId, userId: user.id },
          include: { job: true },
        })
      : null;
    if (body.applicationId && (!application?.job || !application.cvId)) {
      throw new ProfileError(409, "APPLICATION_CONTEXT_INCOMPLETE");
    }
    if (application && application.cvId !== body.cvId) {
      throw new ProfileError(409, "APPLICATION_RESUME_MISMATCH");
    }

    const cv = body.cvId
      ? await prisma.cv.findFirst({
          where: { id: body.cvId, conversation: { userId: user.id } },
        })
      : null;
    if (body.cvId && !cv) throw new ProfileError(404, "RESUME_NOT_FOUND");

    const profile = await getCareerProfile(user.id);
    const resume = cv
      ? normalizeEditorResume(cv as unknown as Record<string, unknown>)
      : undefined;

    // For an existing application its linked job is authoritative.
    const sourceText = application?.job?.description ?? body.text;
    const description = normalizeJobText(sourceText);
    jobTextSchema.parse(description);
    const source = application?.job
      ? {
          type: application.job.sourceType,
          url: application.job.sourceUrl ?? undefined,
          name: application.job.sourceName ?? undefined,
          originalText: application.job.originalText ?? description,
        }
      : body.source;
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({
        version: 3,
        userId: user.id,
        applicationJobId: application?.jobId,
        cvId: cv?.id,
        description,
        source,
        language: body.language,
        profile,
        resume,
      }))
      .digest("hex");

    const cached = await prisma.jobMatch.findUnique({
      where: { fingerprint }, include: { job: true },
    });
    if (cached) return NextResponse.json({ ...cached, reused: true });
    if (inFlight.has(fingerprint)) return NextResponse.json(await inFlight.get(fingerprint));

    const operation = (async () => {
      // Do not trust a stored analysis when its citations no longer match the
      // owned posting. Charge only when fresh extraction is actually required.
      const savedAnalysis = validateSavedJobAnalysis(application?.job?.analysis, description);
      if (!savedAnalysis) await reserveProfileAI(user.id, "JOB_ANALYSIS");
      const { analysis, match: result } = await runJobMatchAgent({
        actorId: user.id,
        input: { description, language: body.language, profile, resume, savedAnalysis },
        signal: req.signal,
      });

      return prisma.$transaction(async tx => {
        const job = application?.job ?? await tx.jobOpportunity.create({
          data: {
            userId: user.id,
            title: savedJobTitle({
              title: analysis.title,
              description,
              sourceName: source.name,
            }),
            company: analysis.company || null,
            location: analysis.location || null,
            seniority: analysis.seniority || null,
            description,
            originalText: source.originalText || description,
            sourceUrl: source.url,
            sourceType: source.type,
            sourceName: source.name,
            analysis: analysis as unknown as Prisma.InputJsonValue,
            responsibilities: analysis.responsibilities,
            requiredSkills: analysis.requiredSkills,
            preferredSkills: analysis.preferredSkills,
            technologies: analysis.technologies,
            education: analysis.education,
            experience: analysis.experience,
            keywords: analysis.keywords,
          },
        });

        // Keep the linked job unchanged but persist its analysis for the
        // result page; otherwise the new match cannot be rendered on reload.
        if (application?.job && !savedAnalysis) {
          await tx.jobOpportunity.update({
            where: { id: job.id },
            data: {
              analysis: analysis as unknown as Prisma.InputJsonValue,
              responsibilities: analysis.responsibilities,
              requiredSkills: analysis.requiredSkills,
              preferredSkills: analysis.preferredSkills,
              technologies: analysis.technologies,
              education: analysis.education,
              experience: analysis.experience,
              keywords: analysis.keywords,
            },
          });
        }
        return tx.jobMatch.create({
          data: {
            userId: user.id,
            jobId: job.id,
            cvId: cv?.id,
            fingerprint,
            overallScore: result.overallScore,
            skillScore: result.skillScore,
            keywordScore: result.keywordScore,
            experienceScore: result.experienceScore,
            educationScore: result.educationScore,
            matchedSkills: result.matchedSkills,
            missingSkills: result.missingSkills,
            unverifiedSkills: result.unverifiedSkills,
            recommendations: result.recommendations,
            result: result as unknown as Prisma.InputJsonValue,
          },
          include: { job: true },
        });
      });
    })();

    inFlight.set(fingerprint, operation);
    try { return NextResponse.json(await operation, { status: 201 }); }
    finally { inFlight.delete(fingerprint); }
  } catch (error) {
    return apiError(error);
  }
}
