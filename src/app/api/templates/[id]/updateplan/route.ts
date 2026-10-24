import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "../../../../../../prisma/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { profileJson, profileErrorResponse, ProfileError } from "@/lib/career-profile/http";

const input = z.object({ plan: z.enum(["FREE", "PAID"]), id: z.string().optional() }).strict();
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionUser();
    if (!session) throw new ProfileError(401, "UNAUTHORIZED");
    if (!isAdmin(session)) throw new ProfileError(403, "FORBIDDEN");
    const { id } = await params;
    const payload = input.parse(await profileJson(req, 2048));
    if (payload.id && payload.id !== id) throw new ProfileError(400, "ID_MISMATCH");
    const { plan } = payload;
    const updated = await prisma.template.update({ where: { id }, data: { plan },
      select: { id: true, name: true, type: true, plan: true, markets: true, styleFamily: true, customizable: true, accentColors: true, createdAt: true, updatedAt: true } });
    return NextResponse.json(updated);
  } catch (error) { return profileErrorResponse(error); }
}
