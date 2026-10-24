import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { ProfileError, profileErrorResponse, profileJson } from "@/lib/career-profile/http";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import { decideCoverLetterAI } from "@/lib/cover-letter-ai/proposal-service";

const bodySchema = z.object({ proposalId: z.string().uuid(), action: z.enum(["accept", "discard"]) }).strict();
type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export async function POST(req: Request, { params }: Context) {
  try {
    assertTrustedWriteOrigin(req);
    const user = await getSessionUser(); if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const { id } = await params, body = bodySchema.parse(await profileJson(req, 4 * 1024));
    const result = await decideCoverLetterAI(user.id, id, body.proposalId, body.action);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return profileErrorResponse(error); }
}
