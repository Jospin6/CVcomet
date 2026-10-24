import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { boundedBody, profileErrorResponse } from "@/lib/career-profile/http";
import { enforceAuthThrottle } from "@/lib/security/auth-throttle";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";

const handlers = toNextJsHandler(auth);
export const GET = handlers.GET;

export async function POST(request: NextRequest) {
  try {
    assertTrustedWriteOrigin(request);
    // Clone, so Better Auth can still read the original request after this check.
    const bytes = await boundedBody(request.clone(), 16 * 1024);
    let payload: unknown;
    try { payload = JSON.parse(bytes.toString("utf8")); } catch { payload = null; }
    const email = payload && typeof payload === "object" && "email" in payload && typeof payload.email === "string"
      ? payload.email.trim().toLowerCase() : null;
    if (email) await enforceAuthThrottle(request, "AUTH_PROVIDER", email);
    return handlers.POST(request);
  } catch (error) { return profileErrorResponse(error); }
}
