import { NextResponse } from "next/server";
import prisma from "../../../../../prisma/prisma";
import { getSessionUser } from "@/lib/auth";
import { getCareerModel } from "@/lib/gemini";
import { improveSchema, improveText, reserveProfileAI } from "@/lib/career-profile/ai";
import { ProfileError, profileErrorResponse, profileJson } from "@/lib/career-profile/http";

export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (!session) throw new ProfileError(401, "UNAUTHORIZED");
    const data = improveSchema.parse(await profileJson(req));
    if (data.experienceId) {
      const owned = await prisma.experience.findFirst({ where: { id: data.experienceId, userId: session.id }, select: { id: true } });
      if (!owned) throw new ProfileError(403, "FORBIDDEN");
    }
    getCareerModel();
    await reserveProfileAI(session.id);
    const suggestion = await improveText(data.text, data.field, data.language);
    return NextResponse.json({ suggestion }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return profileErrorResponse(error); }
}
