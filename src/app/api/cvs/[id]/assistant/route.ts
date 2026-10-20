import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "../../../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
import { reserveProfileAI } from "@/lib/career-profile/ai";
import { getCareerProfile, careerProfileContext } from "@/lib/career-profile/service";
import { ProfileError, profileErrorResponse, profileJson } from "@/lib/career-profile/http";
import { normalizeEditorResume } from "@/lib/resume-editor";
import { generateResumeConversation } from "@/lib/resume-conversation-ai";

const inputSchema = z.object({
  instruction: z.string().trim().min(1).max(4000),
  language: z.enum(["fr", "en"]),
  revision: z.number().int().nonnegative(),
  selectedField: z.string().max(100).optional(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }).strict()).max(8).optional(),
}).strict();

export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Context) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const { id } = await params;
    const input = inputSchema.parse(await profileJson(req));
    const cv = await prisma.cv.findFirst({ where: { id, conversation: { userId: user.id } } });
    if (!cv) throw new ProfileError(404, "NOT_FOUND");
    if (cv.revision !== input.revision) throw new ProfileError(409, "CONFLICT");

    const [profile, linkedMatch] = await Promise.all([
      getCareerProfile(user.id),
      prisma.jobMatch.findFirst({
        where: { userId: user.id, cvId: id }, orderBy: { createdAt: "desc" },
        include: { job: { select: { title: true, description: true, requiredSkills: true, preferredSkills: true } } },
      }),
    ]);
    const document = normalizeEditorResume(cv);
    await reserveProfileAI(user.id);
    const { object, document: edited } = await generateResumeConversation({
      ...input, document, careerProfile: careerProfileContext(profile), linkedJobAdvert: linkedMatch?.job || null,
    });
    if (object.status === "clarification") return NextResponse.json({ ...object, document: null, revision: cv.revision }, { headers: { "Cache-Control": "no-store" } });

    if (!edited) throw new ProfileError(502, "AI_INVALID_RESPONSE");
    const updated = await prisma.$transaction(async tx => {
      const latest = await tx.cv.findFirst({ where: { id, conversation: { userId: user.id } } });
      if (!latest) throw new ProfileError(404, "NOT_FOUND");
      if (latest.revision !== input.revision) throw new ProfileError(409, "CONFLICT");
      const changed = await tx.cv.updateMany({ where: { id, revision: latest.revision, conversation: { userId: user.id } }, data: { ...edited, revision: { increment: 1 } } });
      if (!changed.count) throw new ProfileError(409, "CONFLICT");
      await tx.resumeVersion.create({ data: { cvId: id, label: "Before AI conversation edit", snapshot: JSON.parse(JSON.stringify(latest)) } });
      return tx.cv.findUniqueOrThrow({ where: { id } });
    }, { maxWait: 10000, timeout: 20000 });
    return NextResponse.json({ ...object, changes: object.summary, document: updated, revision: updated.revision }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return profileErrorResponse(error);
  }
}
