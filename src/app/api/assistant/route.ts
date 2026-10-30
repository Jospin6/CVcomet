import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";
import { profileJson } from "@/lib/career-profile/http";
import { runCareerAgent } from "@/lib/career-os/agent-service";
import { CareerContractError } from "@/lib/career-os/contracts";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";

const input = z.object({ message: z.string().trim().min(2).max(6000), applicationId: z.string().uuid().optional() }).strict();
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Keep the legacy {message} response for the existing dashboard client. */
export async function POST(req: Request) {
  try {
    assertTrustedWriteOrigin(req);
    const actor = await requireUser();
    const { message, applicationId } = input.parse(await profileJson(req, 8 * 1024));
    return NextResponse.json(applicationId
      ? await runCareerAgent(actor, message, req.signal, [], applicationId)
      : await runCareerAgent(actor, message, req.signal), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof CareerContractError) return NextResponse.json({ error: error.code }, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
    return apiError(error);
  }
}
