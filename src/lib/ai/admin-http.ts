import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { ProfileError, profileAIError, boundedBody } from "@/lib/career-profile/http";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";

export async function requireAIAdmin(req: Request, mutation = false) {
  const user = await getSessionUser();
  if (!user) throw new ProfileError(401, "UNAUTHORIZED");
  if (!isAdmin(user)) throw new ProfileError(403, "FORBIDDEN");
  if (mutation) {
    assertTrustedWriteOrigin(req);
  }
  return user;
}

export async function aiAdminBody(req: Request) {
  if (!req.headers.get("content-type")?.includes("application/json")) throw new ProfileError(415, "INVALID_TYPE");
  return JSON.parse((await boundedBody(req, 16 * 1024)).toString("utf8")) as unknown;
}

export function aiAdminResponse(data: unknown) {
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export function aiAdminError(error: unknown) {
  const failure = error instanceof ProfileError ? error
    : error instanceof ZodError || error instanceof SyntaxError ? new ProfileError(400, "VALIDATION")
      : profileAIError(error);
  return NextResponse.json({ error: failure.code }, { status: failure.status, headers: { "Cache-Control": "no-store" } });
}
