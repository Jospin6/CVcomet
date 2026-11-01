import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "../../../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
import { ProfileError, profileAIError, profileErrorResponse, profileJson } from "@/lib/career-profile/http";
import { jobAnalysisSchema } from "@/lib/career/job-schema";
import { normalizeCoverLetter } from "@/lib/cover-letter-editor";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import { getPendingCoverLetterAI, proposeCoverLetterAI } from "@/lib/cover-letter-ai/proposal-service";
import { getProfileFacts } from "@/lib/career-profile/ai-facts";
import { runCoverLetterEditAgent } from "@/lib/agentic/agents/cover-letter/agent/cover-letter.agent";

type Context = { params: Promise<{ id: string }> };
const input = z.object({ targetField: z.enum(["introduction", "body", "conclusion"]).optional(), instruction: z.string().trim().min(1).max(4000), language: z.enum(["fr", "en"]), revision: z.number().int().nonnegative(), history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }).strict()).max(8).optional() }).strict();

export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: Context) {
  try {
    const user = await getSessionUser(); if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const { id } = await params;
    return NextResponse.json(await getPendingCoverLetterAI(user.id, id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return profileErrorResponse(error); }
}

/** Generates only an expiring suggestion. No coverLetter mutations occur here. */
export async function POST(req: Request, { params }: Context) {
  try {
    assertTrustedWriteOrigin(req);
    const user = await getSessionUser(); if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const { id } = await params, body = input.parse(await profileJson(req, 32 * 1024));
    const letter = await prisma.coverLetter.findFirst({ where: { id, conversation: { userId: user.id } }, include: { job: true } });
    if (!letter) throw new ProfileError(404, "NOT_FOUND");
    if (letter.job && letter.job.userId !== user.id) throw new ProfileError(403, "JOB_NOT_AUTHORIZED");
    if (letter.revision !== body.revision) throw new ProfileError(409, "CONFLICT");
    const evidence = await getProfileFacts(user.id, 50);
    const document = normalizeCoverLetter(letter as unknown as Record<string, unknown>);
    const parsed = jobAnalysisSchema.safeParse(letter.job?.analysis);
    const requirements = parsed.success ? parsed.data.requirements.filter(item => item.category === "TECHNICAL").flatMap(item => item.terms) : [];
    // Graph: plan -> generate -> verify -> review. No mutation of a CoverLetter here.
    const result = await runCoverLetterEditAgent({
      actorId: user.id,
      signal: req.signal,
      input: {
        document, instruction: body.instruction, language: body.language,
        targetField: body.targetField, history: body.history ?? [],
        profileFacts: evidence, requirements,
        jobTarget: letter.job ? { title: letter.job.title, company: letter.job.company || "",
          description: letter.job.description } : null,
      },
    });
    if (result.status === "clarification" || !result.document) {
      return NextResponse.json({ status: "clarification", message: result.message,
        changes: [], revision: body.revision }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json(await proposeCoverLetterAI({
      userId: user.id,
      letterId: id,
      revision: body.revision,
      before: document,
      after: result.document,
      message: result.message,
      changes: result.changes,
      evidence,
      requirements,
    }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return profileErrorResponse(error instanceof ProfileError || error instanceof z.ZodError ? error : profileAIError(error)); }
}
