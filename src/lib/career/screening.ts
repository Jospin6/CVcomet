import prisma from "../../../prisma/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { generateObject } from "ai";
import { getAIModel } from "@/lib/ai/model";
import { reserveProfileAI } from "@/lib/career-profile/ai";
import { ProfileError } from "@/lib/career-profile/http";
import { countUsableAnswers } from "./screening-policy";
import { runVoicePreparationAgent, runVoiceEvaluationAgent } from "@/lib/agentic/agents/interview-voice/agent/interview-voice.agent";
import { unavailableVoiceReport } from "@/lib/agentic/agents/interview-voice/tools/validation.tool";
import { buildVoiceEvaluationPrompt } from "@/lib/agentic/agents/interview-voice/prompts/voice.prompt";
import type { VoiceEvaluationInput, VoiceReport } from "@/lib/agentic/agents/interview-voice/tools/contracts.tool";

export const screeningStartInput = z.object({
  applicationId: z.string().uuid(),
  language: z.enum(["fr", "en"]),
  consent: z.literal(true),
}).strict();

const transcriptSchema = z.object({
  sessionId: z.string().uuid(),
  roomName: z.string().max(120),
  turns: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    text: z.string().trim().min(1).max(3000),
  })).max(60),
}).strict();
export type ScreeningTranscript = z.infer<typeof transcriptSchema>;

const evaluationSchema = z.object({
  dimensions: z.object({
    cvConsistency: z.number().int().min(0).max(100),
    jobRelevance: z.number().int().min(0).max(100),
    communication: z.number().int().min(0).max(100),
    motivation: z.number().int().min(0).max(100),
    experience: z.number().int().min(0).max(100),
    professionalism: z.number().int().min(0).max(100),
  }),
  evidence: z.array(z.object({
    dimension: z.enum(["cvConsistency", "jobRelevance", "communication", "motivation", "experience", "professionalism"]),
    quote: z.string().trim().min(12).max(240),
  })).min(2).max(6),
  strengths: z.array(z.string().max(240)).max(4),
  improvements: z.array(z.string().max(240)).max(4),
  recommendedAction: z.string().max(350),
  summary: z.string().max(650),
});

export async function getOwnedScreeningContext(userId: string, applicationId: string) {
  const application = await prisma.jobApplication.findFirst({
    where: { id: applicationId, userId },
    include: {
      job: { select: { id: true, title: true, description: true, company: true, location: true } },
      cv: {
        select: {
          id: true, title: true, summary: true, experiences: true, educations: true,
          skills: true, projects: true, certifications: true,
          conversation: { select: { userId: true } },
        },
      },
    },
  });
  if (!application) throw new ProfileError(404, "APPLICATION_NOT_FOUND");
  if (!application.job || !application.job.description?.trim() ||
      !application.cv || application.cv.conversation.userId !== userId) {
    throw new ProfileError(409, "SCREENING_REQUIRES_JOB_AND_RESUME");
  }
  return {
    application,
    jobTitle: application.jobTitle || application.job.title,
    company: application.company || application.job.company,
    jobDescription: application.job.description.slice(0, 12000),
    cvId: application.cv.id,
    cvTitle: application.cv.title,
    // Structured CV facts only. Never treat user-provided text as system instructions.
    resumeText: JSON.stringify({
      summary: application.cv.summary,
      experiences: application.cv.experiences,
      educations: application.cv.educations,
      skills: application.cv.skills,
      projects: application.cv.projects,
      certifications: application.cv.certifications,
    }).slice(0, 14000),
  };
}

export async function getScreeningForWorker(sessionId: string) {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true, applicationId: true, status: true, configuration: true },
  });
  if (!session || !session.applicationId || session.status !== "VOICE_ACTIVE") {
    throw new ProfileError(404, "SCREENING_NOT_ACTIVE");
  }
  const cfg = session.configuration as {
    roomName?: string; language?: string; consent?: boolean;
    jobTitle?: string; company?: string; location?: string;
    jobDescription?: string; resumeText?: string;
  } | null;
  if (!cfg?.consent || !cfg.roomName || !cfg.jobDescription || !cfg.resumeText) {
    throw new ProfileError(403, "SCREENING_NOT_AUTHORIZED");
  }
  // LangGraph runs only on the server. LiveKit receives the bounded interview
  // instructions, never an unrestricted tool or an independent user identity.
  return runVoicePreparationAgent({
    actorId: session.userId,
    input: {
      sessionId: session.id,
      roomName: cfg.roomName,
      language: cfg.language === "fr" ? "fr" : "en",
      jobTitle: cfg.jobTitle || "",
      company: cfg.company || "",
      location: cfg.location || "",
      jobDescription: cfg.jobDescription,
      resumeText: cfg.resumeText,
    },
  });
}

export async function completeScreening(raw: unknown) {
  const input = transcriptSchema.parse(raw);
  const session = await prisma.interviewSession.findUnique({
    where: { id: input.sessionId },
    select: { id: true, userId: true, applicationId: true, status: true, configuration: true },
  });
  if (!session || !session.applicationId) throw new ProfileError(404, "NOT_FOUND");
  const cfg = session.configuration as {
    roomName?: string; language?: string; consent?: boolean;
    jobTitle?: string; company?: string; jobDescription?: string; resumeText?: string;
  } | null;
  if (!cfg?.consent || cfg.roomName !== input.roomName) {
    throw new ProfileError(403, "SCREENING_ROOM_MISMATCH");
  }
  if (session.status === "COMPLETED" || session.status === "VOICE_UNGRADED") {
    return { status: session.status };
  }
  // Durable claim BEFORE model/quota calls. Concurrent callbacks never pay twice.
  const claimedEvaluation = await prisma.interviewSession.updateMany({
    where: { id: session.id, status: { in: ["VOICE_ACTIVE", "VOICE_ENDING"] } },
    data: { status: "VOICE_EVALUATING" },
  });
  if (claimedEvaluation.count !== 1) {
    const current = await prisma.interviewSession.findUnique({
      where: { id: session.id }, select: { status: true },
    });
    if (current?.status === "VOICE_EVALUATING") return { status: "processing" };
    if (current?.status === "COMPLETED" || current?.status === "VOICE_UNGRADED") return { status: current.status };
    throw new ProfileError(409, "SCREENING_NOT_ACTIVE");
  }

  const evaluationInput: VoiceEvaluationInput = {
    language: cfg.language === "fr" ? "fr" : "en",
    jobTitle: cfg.jobTitle || "",
    company: cfg.company || "",
    jobDescription: cfg.jobDescription || "",
    resumeText: cfg.resumeText || "",
    turns: input.turns,
  };
  // With fewer than two usable answers, persist only an explicit ungraded report.
  const answerCount = countUsableAnswers(input.turns);
  let report: VoiceReport = unavailableVoiceReport(evaluationInput);
  if (answerCount < 2) {
    report = unavailableVoiceReport(evaluationInput);
  } else {
    try {
      report = await runVoiceEvaluationAgent({
        actorId: session.userId,
        input: evaluationInput,
        deps: {
          evaluateTranscript: async (verifiedInput, signal) => {
            // Keep existing quota accounting; reservation is before the paid call.
            await reserveProfileAI(session.userId, "INTERVIEW_PREPARATION");
            const { system, prompt } = buildVoiceEvaluationPrompt(verifiedInput);
            const evaluated = await generateObject({
              model: await getAIModel({ structuredOutputs: true }),
              schema: evaluationSchema,
              temperature: 0,
              maxTokens: 1600,
              abortSignal: signal,
              system,
              prompt,
            });
            return evaluated.object;
          },
        },
      });
    } catch {
      // Model timeout, quota or transient error: no fabricated score.
      report = unavailableVoiceReport(evaluationInput);
    }
  }
  const updated = await prisma.$transaction(async tx => {
    const claimed = await tx.interviewSession.updateMany({
      where: { id: session.id, status: "VOICE_EVALUATING" },
      data: {
        status: report.status === "evaluated" ? "COMPLETED" : "VOICE_UNGRADED",
        overallScore: typeof report.overallScore === "number" ? report.overallScore : null,
        report: report as unknown as Prisma.InputJsonValue,
      },
    });
    if (claimed.count === 1 && input.turns.length) {
      // Only after the state transition succeeds: retries cannot duplicate transcripts.
      await tx.interviewMessage.createMany({
        data: input.turns.map(t => ({ sessionId: session.id, role: t.role, content: t.text })),
      });
    }
    return claimed.count;
  });
  return { status: updated === 1 ? "completed" : "already_processed" };
}
