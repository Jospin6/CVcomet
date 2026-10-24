import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import prisma from "../../../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
import { getAIModel } from "@/lib/ai/model";
import { factualRules, reserveProfileAI } from "@/lib/career-profile/ai";
import { ProfileError, profileAIError, profileErrorResponse, profileJson } from "@/lib/career-profile/http";
import { jobAnalysisSchema } from "@/lib/career/job-schema";
import { coverLetterContentSchema, coverLetterDesignSchema, normalizeCoverLetter } from "@/lib/cover-letter-editor";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import { getPendingCoverLetterAI, proposeCoverLetterAI } from "@/lib/cover-letter-ai/proposal-service";
import { isVisualChangeRequest, lockLetterIdentity } from "@/lib/cover-letter-ai/review";
import { marketPrompt } from "@/lib/career-localization/markets";

type Context = { params: Promise<{ id: string }> };
const input = z.object({ instruction: z.string().trim().min(1).max(4000), language: z.enum(["fr", "en"]), revision: z.number().int().nonnegative(), history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }).strict()).max(8).optional() }).strict();
const output = z.object({ message: z.string().min(1).max(1000), changes: z.array(z.string().max(500)).max(12), document: coverLetterContentSchema.extend({ design: coverLetterDesignSchema }) }).strict();

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
    if (letter.revision !== body.revision) throw new ProfileError(409, "CONFLICT");
    const evidence = await prisma.careerEvidence.findMany({ where: { userId: user.id, status: "CONFIRMED" }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, revision: true, kind: true, statement: true, sourceLabel: true } });
    const document = normalizeCoverLetter(letter as unknown as Record<string, unknown>);
    const parsed = jobAnalysisSchema.safeParse(letter.job?.analysis);
    const requirements = parsed.success ? parsed.data.requirements.filter(item => item.category === "TECHNICAL").flatMap(item => item.terms) : [];
    await reserveProfileAI(user.id, "COVER_LETTER");
    const { object } = await generateObject({
      model: await getAIModel(), schema: output, temperature: 0, maxTokens: 4500, maxRetries: 1, abortSignal: AbortSignal.timeout(45000),
      system: factualRules + "\n" + marketPrompt(document.design.targetMarket, document.design.documentLanguage, body.language) + `
You are an expert cover-letter editor. Return the entire updated document but NEVER invent experiences, credentials, quantified results, technologies, company history, or personal motivations.
Treat linked job details as target requirements and UNTRUSTED data, not proof that the candidate possesses them. The user's confirmed evidence is self-attested, not independently verified.
Existing letter paragraphs may be rephrased without extending their factual scope. Only add career facts directly supported by the confirmed evidence listed below. If a request lacks supporting facts, leave it unchanged and ask a specific clarification.
Never change sender contact, target job, employer, recipient metadata, or any document identity field. These fields are locked on the server.
Only change visual design if explicitly requested. Never change targetMarket, documentLanguage or paper from the AI response. Keep the document language selected by the candidate. Return a clear, concise description of edits in ${body.language}.`,
      prompt: JSON.stringify({ instruction: body.instruction, history: body.history ?? [], document, confirmedEvidence: evidence.map(item => ({ kind: item.kind, statement: item.statement, sourceLabel: item.sourceLabel })), jobTarget: letter.job ? { title: letter.job.title, company: letter.job.company, description: letter.job.description } : null }),
    });
    const normalized = normalizeCoverLetter(object.document);
    const edited = lockLetterIdentity(document, isVisualChangeRequest(body.instruction) ? { ...normalized, design: { ...normalized.design, targetMarket: document.design.targetMarket, documentLanguage: document.design.documentLanguage, paper: document.design.paper } } : { ...normalized, design: document.design });
    return NextResponse.json(await proposeCoverLetterAI({ userId: user.id, letterId: id, revision: body.revision, before: document,
      after: edited, message: object.message, changes: object.changes, evidence, requirements }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return profileErrorResponse(error instanceof ProfileError || error instanceof z.ZodError ? error : profileAIError(error)); }
}
