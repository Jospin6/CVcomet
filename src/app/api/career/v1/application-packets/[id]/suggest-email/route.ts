import { generateObject } from "ai";
import { z } from "zod";
import prisma from "../../../../../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
import { getAIModel } from "@/lib/ai/model";
import { reserveProfileAI } from "@/lib/career-profile/ai";
import { profileAIError, profileJson } from "@/lib/career-profile/http";
import { requireFeature } from "@/lib/career/entitlements";
import { assertDocumentFacts } from "@/lib/career/job-documents";
import { jobAnalysisSchema } from "@/lib/career/job-schema";
import { getProfileFacts } from "@/lib/career-profile/ai-facts";
import { CareerContractError } from "@/lib/career-os/contracts";
import { withCareerHttp } from "@/lib/career-os/http";
import { assertSourcesCurrent } from "@/lib/career-os/application-packet-policy";
import { runApplicationSuggestionAgent } from "@/lib/agentic/agents/application/agent/application.agent";
import { applicationEmailPrompt } from "@/lib/agentic/agents/application/prompts/email.prompt";
import { AgenticError } from "@/lib/agentic/core/errors";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";

export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
const inputSchema = z.object({ apiVersion: z.literal("v1"), revision: z.number().int().min(0) }).strict();
const suggestionSchema = z.object({ subject: z.string().trim().min(3).max(300), body: z.string().trim().min(20).max(6000) }).strict();

/** Explicit opt-in and READ-ONLY suggestion. No packet mutation or employer contact. */
export async function POST(req: Request, ctx: Context) {
  return withCareerHttp("application-packet.suggest-email", async () => {
    assertTrustedWriteOrigin(req);
    const actor = await getSessionUser();
    if (!actor) throw new CareerContractError(401, "UNAUTHORIZED");
    const input = inputSchema.parse(await profileJson(req, 1024));
    const id = z.string().uuid().parse((await ctx.params).id);
    const packet = await prisma.careerApplicationPacket.findFirst({ where: { id, userId: actor.id }, include: {
      job: { select: { title: true, company: true, description: true, analysis: true, updatedAt: true } },
      cv: { select: { revision: true } },
      coverLetter: { select: { revision: true } },
    } });
    if (!packet) throw new CareerContractError(404, "PACKET_NOT_FOUND");
    if (packet.status !== "DRAFT" || packet.revision !== input.revision) throw new CareerContractError(409, "PACKET_CHANGED");
    assertSourcesCurrent(packet, { cvRevision: packet.cv.revision, letterRevision: packet.coverLetter?.revision ?? null, jobUpdatedAt: packet.job.updatedAt });

    const evidence = await getProfileFacts(actor.id, 50);
    const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { name: true } });
    const analysis = jobAnalysisSchema.safeParse(packet.job.analysis);
    const technical = analysis.success ? analysis.data.requirements.filter(x => x.category === "TECHNICAL").flatMap(x => x.terms) : [];
    const agentInput = {
      language: packet.language as "fr" | "en",
      jobTitle: packet.job.title.slice(0, 240), company: packet.job.company?.slice(0, 240) ?? null,
      description: packet.job.description.slice(0, 6000), signer: user?.name?.slice(0, 160) ?? null,
      profileFacts: evidence.slice(0, 50).map(x => x.statement.slice(0, 400)),
      technicalTerms: technical.slice(0, 120).map(x => x.slice(0, 120)),
    };

    await requireFeature(actor.id, "COVER_LETTER");
    const model = await getAIModel();
    await reserveProfileAI(actor.id, "APPLICATION_EMAIL");

    let suggestion: z.infer<typeof suggestionSchema>;
    try {
      suggestion = await runApplicationSuggestionAgent({ actorId: actor.id, input: agentInput, deps: {
        generateEmail: async (context, signal) => {
          const { system, prompt } = applicationEmailPrompt(context);
          try {
            const generated = await generateObject({ model, schema: suggestionSchema, maxTokens: 1200, maxRetries: 1,
              abortSignal: signal, system, prompt });
            return suggestionSchema.parse(generated.object);
          } catch (error) { throw profileAIError(error); }
        },
        verifyFacts: (email, context) => {
          assertDocumentFacts(email.body, context.profileFacts.join("\n"), context.technicalTerms, [context.signer || ""]);
        },
      } });
    } catch (error) {
      if (error instanceof CareerContractError) throw error;
      if (error instanceof AgenticError) throw new CareerContractError(error.status, error.code);
      throw profileAIError(error);
    }

    // Recheck the current owned packet and source revisions AFTER the potentially slow model call.
    // Preview may otherwise target a newly approved, deleted or stale document packet.
    const latest = await prisma.careerApplicationPacket.findFirst({ where: { id, userId: actor.id }, include: {
      job: { select: { updatedAt: true } }, cv: { select: { revision: true } }, coverLetter: { select: { revision: true } },
    } });
    if (!latest || latest.status !== "DRAFT" || latest.revision !== input.revision) throw new CareerContractError(409, "PACKET_CHANGED");
    assertSourcesCurrent(latest, { cvRevision: latest.cv.revision, letterRevision: latest.coverLetter?.revision ?? null, jobUpdatedAt: latest.job.updatedAt });
    if (latest.jobUpdatedAt.getTime() !== packet.jobUpdatedAt.getTime() || latest.cvRevision !== packet.cvRevision || latest.letterRevision !== packet.letterRevision) {
      throw new CareerContractError(409, "PACKET_SOURCE_CHANGED");
    }
    return { suggestion, saved: false, sent: false, reviewed: false };
  });
}
