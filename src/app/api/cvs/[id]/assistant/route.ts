import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "../../../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
import { reserveProfileAI } from "@/lib/career-profile/ai";
import { ProfileError, profileErrorResponse, profileJson } from "@/lib/career-profile/http";
import { normalizeEditorResume } from "@/lib/resume-editor";
import { generateResumeConversation } from "@/lib/resume-conversation-ai";
import { proposeResumeAI } from "@/lib/resume-ai/proposal-service";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";

const inputSchema = z.object({
  instruction: z.string().trim().min(1).max(4000),
  language: z.enum(["fr", "en"]),
  revision: z.number().int().nonnegative(),
  selectedField: z.string().max(100).optional(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }).strict()).max(8).optional(),
}).strict();

export const maxDuration = 60;
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

/** Phase 03: AI suggestions are persisted as time-limited proposals, not CV edits. */
export async function POST(req: Request, { params }: Context) {
  try {
    assertTrustedWriteOrigin(req);
    const user = await getSessionUser();
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const { id } = await params;
    const input = inputSchema.parse(await profileJson(req, 32 * 1024));
    const cv = await prisma.cv.findFirst({ where: { id, conversation: { userId: user.id } } });
    if (!cv) throw new ProfileError(404, "NOT_FOUND");
    if (cv.revision !== input.revision) throw new ProfileError(409, "CONFLICT");
    const [confirmedEvidence, linkedMatch] = await Promise.all([
      prisma.careerEvidence.findMany({ where: { userId: user.id, status: "CONFIRMED" }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, revision: true, kind: true, statement: true, sourceLabel: true } }),
      prisma.jobMatch.findFirst({ where: { userId: user.id, cvId: id }, orderBy: { createdAt: "desc" },
        include: { job: { select: { title: true, description: true, requiredSkills: true, preferredSkills: true } } } }),
    ]);
    const document = normalizeEditorResume(cv);
    await reserveProfileAI(user.id, "RESUME_EDIT");
    const { object, document: edited } = await generateResumeConversation({
      ...input, document, confirmedEvidence: confirmedEvidence.map(row => ({ kind: row.kind, statement: row.statement, sourceLabel: row.sourceLabel })),
      linkedJobAdvert: linkedMatch?.job || null,
    });
    if (object.status === "clarification") return NextResponse.json({ ...object, preview: null, revision: cv.revision }, { headers: { "Cache-Control": "no-store" } });
    if (!edited) throw new ProfileError(502, "AI_INVALID_RESPONSE");
    const proposal = await proposeResumeAI({ userId: user.id, cvId: id, revision: input.revision, current: document, edited,
      edits: object.edits, message: object.message, summary: object.summary, evidence: confirmedEvidence, instruction: input.instruction });
    return NextResponse.json({ status: "proposal", message: object.message, changes: object.summary, ...proposal,
      evidenceDisclosure: "owner-confirmed-not-independently-verified" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return profileErrorResponse(error); }
}
