import { NextResponse } from "next/server";
import { profileJson, profileErrorResponse } from "@/lib/career-profile/http";
import { enforceAuthThrottle } from "@/lib/security/auth-throttle";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import { normalizeVerificationEmail } from "@/lib/auth/email-verification-code";
import { requestEmailVerification } from "@/lib/auth/email-verification-service";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await profileJson(request, 4096);
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const email = normalizeVerificationEmail((payload as { email?: unknown } | null)?.email);
  if (!email) return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  try { assertTrustedWriteOrigin(request); await enforceAuthThrottle(request, "EMAIL_RESEND", email); } catch (error) { return profileErrorResponse(error); }

  try {
    await requestEmailVerification(email);
  } catch {
    return NextResponse.json({ error: "Service temporairement indisponible" }, { status: 503 });
  }
  return NextResponse.json(
    { success: true, message: "Si ce compte nécessite une vérification, un code sera envoyé." },
    { headers: { "Cache-Control": "no-store" } },
  );
}
