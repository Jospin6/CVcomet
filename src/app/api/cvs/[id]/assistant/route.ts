import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "../../../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
import { ProfileError, profileErrorResponse, profileJson } from "@/lib/career-profile/http";
import { normalizeEditorResume } from "@/lib/resume-editor";
import {
  applyResumeConversationEdits,
  resumeConversationChanges,
  resumeConversationFields,
} from "@/lib/resume-conversation";
import { runResumeAgent } from "@/lib/agentic/agents/resume/agent/resume.agent";
import { proposeResumeAI } from "@/lib/resume-ai/proposal-service";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import { getProfileFacts } from "@/lib/career-profile/ai-facts";

const inputSchema = z.object({
  instruction: z.string().trim().min(1).max(4000),
  language: z.enum(["fr", "en"]),
  revision: z.number().int().nonnegative(),
  selectedField: z.string().max(100).optional(),
  targetField: z.string().min(1).max(100).optional(),
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
    const [profileEvidence, linkedMatch] = await Promise.all([
      getProfileFacts(user.id, 50),
      prisma.jobMatch.findFirst({ where: { userId: user.id, cvId: id }, orderBy: { createdAt: "desc" },
        include: { job: { select: { title: true, description: true, requiredSkills: true, preferredSkills: true } } } }),
    ]);
    const document = normalizeEditorResume(cv);
    if (input.targetField && !resumeConversationFields(document).includes(input.targetField)) {
      throw new ProfileError(400, "INVALID_FIELD");
    }
    // LangGraph now plans, generates, validates and prepares review. Quota is
    // reserved inside its model tool, only if a model call is required.
    const { object, document: edited } = await runResumeAgent({
      actorId: user.id,
      signal: req.signal,
      input: { ...input, document, profileFacts: profileEvidence,
        linkedJobAdvert: linkedMatch?.job || null },
    });
    if (object.status === "clarification") return NextResponse.json({ ...object, preview: null, revision: cv.revision }, { headers: { "Cache-Control": "no-store" } });
    if (!edited) throw new ProfileError(502, "AI_INVALID_RESPONSE");

    // Apply only the user's selected field in focused mode, never unrelated edits.
    const focusedEdits = input.targetField
      ? object.edits.filter(edit => edit.type === "setField" && edit.path === input.targetField)
      : object.edits;
    if (input.targetField && !focusedEdits.length) {
      return NextResponse.json({
        status: "clarification",
        message: input.language === "fr"
          ? "Impossible de proposer une modification ciblée sûre. Précisez votre demande."
          : "No safe targeted edit could be proposed. Please clarify your request.",
        preview: null,
        revision: cv.revision,
      }, { headers: { "Cache-Control": "no-store" } });
    }
    const finalDocument = input.targetField
      ? applyResumeConversationEdits(document, focusedEdits)
      : edited;
    const changes = input.targetField
      ? resumeConversationChanges(focusedEdits)
      : object.summary;
    const proposal = await proposeResumeAI({
      userId: user.id,
      cvId: id,
      revision: input.revision,
      current: document,
      edited: finalDocument,
      edits: focusedEdits,
      message: object.message,
      summary: changes,
      evidence: profileEvidence,
      instruction: input.instruction,
    });
    return NextResponse.json({
      status: "proposal",
      message: object.message,
      changes,
      ...proposal,
      evidenceDisclosure: "self-reported-career-profile",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return profileErrorResponse(error); }
}
