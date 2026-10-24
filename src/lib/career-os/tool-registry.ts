import { z } from "zod";
import prisma from "../../../prisma/prisma";
import { getCareerProfile, careerProfileContext } from "@/lib/career-profile/service";
import { listConfirmedEvidenceForAgent } from "@/lib/career-evidence/service";
import { buildJobIntelligence, isReadableMatchSnapshot } from "@/lib/career/job-intelligence";
import { jobAnalysisSchema } from "@/lib/career/job-schema";
import {
  CAREER_READ_TOOLS, CAREER_TOOL_CATALOG, CareerContractError,
  isCareerReadTool, type CareerReadTool,
} from "./contracts";
import { authorizeCareerTool, requireEnabledReadTool, type CareerActor } from "./policy";

const empty = z.object({}).strict();
const limited = z.object({ limit: z.number().int().min(1).max(30).default(15) }).strict();
const resumeById = z.object({ resumeId: z.string().uuid() }).strict();
const matchById = z.object({ matchId: z.string().uuid() }).strict();

/** One input schema per tool. Unrecognized keys, e.g. userId, are rejected. */
const inputSchemas = {
  get_my_profile: empty,
  list_my_resumes: limited,
  get_my_resume: resumeById,
  list_my_applications: limited,
  list_my_confirmed_evidence: limited,
  get_my_job_match_insights: matchById,
  list_my_application_packets: limited,
} as const satisfies Record<CareerReadTool, z.ZodTypeAny>;

export const toolRequestSchema = z.object({
  apiVersion: z.string().min(1).max(12),
  tool: z.string().min(1).max(80),
  input: z.unknown().optional(),
}).strict();

export function availableCareerTools() {
  return CAREER_TOOL_CATALOG.map(({ id, effect, available, description, requiresApproval }) =>
    ({ id, effect, available, description, requiresApproval }));
}

/**
 * The model or HTTP caller can select a tool but cannot choose the owner.
 * Ownership is enforced in every DB query, including nested CV ownership.
 * Do not put admin cross-tenant privileges in this registry.
 */
export async function executeCareerReadTool(actor: CareerActor, name: string, rawInput: unknown) {
  requireEnabledReadTool(name, CAREER_READ_TOOLS);
  if (!isCareerReadTool(name)) throw new CareerContractError(404, "TOOL_NOT_AVAILABLE");
  authorizeCareerTool({ actor, ownerId: actor.id, effect: "read" });
  switch (name) {
    case "get_my_profile": {
      inputSchemas.get_my_profile.parse(rawInput ?? {});
      return careerProfileContext(await getCareerProfile(actor.id));
    }
    case "list_my_resumes": {
      const { limit } = inputSchemas.list_my_resumes.parse(rawInput ?? {});
      return prisma.cv.findMany({
        where: { conversation: { userId: actor.id } },
        select: { id: true, title: true, revision: true, updatedAt: true, templateId: true },
        orderBy: { updatedAt: "desc" }, take: limit,
      });
    }
    case "get_my_resume": {
      const { resumeId } = inputSchemas.get_my_resume.parse(rawInput ?? {});
      const resume = await prisma.cv.findFirst({
        where: { id: resumeId, conversation: { userId: actor.id } },
        select: {
          id: true, title: true, revision: true, summary: true, skills: true,
          experiences: true, educations: true, certifications: true, projects: true,
          languages: true, contact: true, design: true, templateId: true, updatedAt: true,
        },
      });
      if (!resume) throw new CareerContractError(404, "RESOURCE_NOT_FOUND");
      return resume;
    }
    case "list_my_confirmed_evidence": {
      const { limit } = inputSchemas.list_my_confirmed_evidence.parse(rawInput ?? {});
      return listConfirmedEvidenceForAgent(actor.id, limit);
    }
    case "get_my_job_match_insights": {
      const { matchId } = inputSchemas.get_my_job_match_insights.parse(rawInput ?? {});
      // Actor identity comes exclusively from the authenticated server session.
      const match = await prisma.jobMatch.findFirst({
        where: { id: matchId, userId: actor.id },
        select: { id: true, overallScore: true, result: true,
          job: { select: { title: true, company: true, analysis: true } } },
      });
      if (!match) throw new CareerContractError(404, "RESOURCE_NOT_FOUND");
      const job = jobAnalysisSchema.safeParse(match.job.analysis);
      const raw = match.result;
      if (!job.success || !isReadableMatchSnapshot(raw)) {
        throw new CareerContractError(409, "JOB_ANALYSIS_REQUIRES_REFRESH");
      }
      const insights = buildJobIntelligence(job.data, raw, "en");
      return { id: match.id, jobTitle: match.job.title, company: match.job.company,
        selfReportedMatchScore: match.overallScore, assessment: insights.assessment,
        coveragePercent: insights.coveragePercent,
        counts: { demonstrated: insights.demonstratedCount, partial: insights.partialCount,
          missing: insights.missingCount, unverified: insights.verifyCount },
        warnings: insights.warnings.slice(0, 4),
        nextActions: insights.actions.filter(item => item.status !== "DEMONSTRATED").slice(0, 5).map(item => ({
          requirementId: item.requirementId, title: item.title, priority: item.priority,
          status: item.status, why: item.why, nextStep: item.nextStep,
          postingQuote: item.postingQuote,
        })) };
    }
    case "list_my_application_packets": {
      const { limit } = inputSchemas.list_my_application_packets.parse(rawInput ?? {});
      return prisma.careerApplicationPacket.findMany({ where: { userId: actor.id }, orderBy: { updatedAt: "desc" }, take: limit, select: { id: true, status: true, approvedAt: true, job: { select: { title: true, company: true } } } });
    }
    case "list_my_applications": {
      const { limit } = inputSchemas.list_my_applications.parse(rawInput ?? {});
      return prisma.jobApplication.findMany({
        where: { userId: actor.id },
        select: {
          id: true, company: true, jobTitle: true, status: true,
          jobUrl: true, nextAction: true, updatedAt: true, deadline: true,
        },
        orderBy: { updatedAt: "desc" }, take: limit,
      });
    }
  }
}
