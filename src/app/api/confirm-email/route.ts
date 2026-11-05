import { NextResponse } from "next/server";
import { profileJson, profileErrorResponse } from "@/lib/career-profile/http";
import { enforceAuthThrottle } from "@/lib/security/auth-throttle";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";
import {
  isValidVerificationCode,
  normalizeVerificationEmail,
} from "@/lib/auth/email-verification-code";
import { confirmEmailVerification } from "@/lib/auth/email-verification-service";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await profileJson(request, 4096);
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  // Le JSON reçu est non fiable : vérifier sa forme avant d'accéder aux champs.
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const email = normalizeVerificationEmail("email" in payload ? payload.email : undefined);
  const code = "code" in payload ? payload.code : undefined;
  if (!email || !isValidVerificationCode(code)) {
    return NextResponse.json({ error: "Code invalide ou expiré" }, { status: 400 });
  }
  try { assertTrustedWriteOrigin(request); await enforceAuthThrottle(request, "EMAIL_CONFIRM", email); } catch (error) { return profileErrorResponse(error); }

  try {
    const verified = await confirmEmailVerification(email, code);
    if (!verified) return NextResponse.json({ error: "Code invalide ou expiré" }, { status: 400 });
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Service temporairement indisponible" }, { status: 503 });
  }
}
