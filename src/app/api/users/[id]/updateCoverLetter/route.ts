import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "../../../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
import { ProfileError, profileErrorResponse, profileJson } from "@/lib/career-profile/http";

const input = z.object({
  id: z.string().uuid(), currentTemplateId: z.string().uuid().nullable(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
}).strict();

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionUser();
    if (!session) throw new ProfileError(401, "UNAUTHORIZED");
    const { id } = await params;
    // A regular user's template selection must affect only their own account.
    if (session.id !== id) throw new ProfileError(403, "FORBIDDEN");
    const body = input.parse(await profileJson(req, 4096));
    if (body.id !== id) throw new ProfileError(403, "FORBIDDEN");
    if (body.currentTemplateId) {
      const allowed = await prisma.template.findFirst({ where: { id: body.currentTemplateId, type: "COVER_LETTER" }, select: { id: true } });
      if (!allowed) throw new ProfileError(400, "INVALID_TEMPLATE");
    }
    const user = await prisma.user.update({ where: { id },
      data: { currentCoverLetterId: body.currentTemplateId, ...(body.accent ? { coverLetterAccent: body.accent } : {}) },
      select: { id: true, currentCoverLetterId: true, coverLetterAccent: true },
    });
    return NextResponse.json(user, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return profileErrorResponse(error); }
}
