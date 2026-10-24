import { NextRequest, NextResponse } from "next/server";
import { authSchema } from "@/helpers/schema";
import { auth, sanitizeUser } from "@/lib/auth";
import { prepareLegacyCredential } from "@/lib/credentials";
import prisma from "../../../../prisma/prisma";
import { profileJson, profileErrorResponse } from "@/lib/career-profile/http";
import { enforceAuthThrottle } from "@/lib/security/auth-throttle";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";

export async function POST(req: NextRequest) {
  let data;
  try { data = await profileJson(req, 16 * 1024); }
  catch { return NextResponse.json({ message: "Invalid JSON" }, { status: 400 }); }

  const parsed = authSchema.safeParse(data);
  if (!parsed.success) return NextResponse.json({ message: parsed.error.errors[0].message }, { status: 400 });
  const email = parsed.data.email.trim().toLowerCase();
  try { assertTrustedWriteOrigin(req); await enforceAuthThrottle(req, "LOGIN", email); } catch (error) { return profileErrorResponse(error); }
  await prepareLegacyCredential(email, parsed.data.password);
  const response = await auth.api.signInEmail({
    body: { ...parsed.data, email },
    headers: req.headers,
    asResponse: true,
  });
  if (!response.ok) return response;
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return NextResponse.json(sanitizeUser(user), { headers: response.headers });
}
