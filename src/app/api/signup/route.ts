import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authSchema } from "@/helpers/schema";
import { auth, sanitizeUser } from "@/lib/auth";
import prisma from "../../../../prisma/prisma";
import { profileJson, profileErrorResponse } from "@/lib/career-profile/http";
import { enforceAuthThrottle } from "@/lib/security/auth-throttle";
import { assertTrustedWriteOrigin } from "@/lib/security/request-origin";

const registerSchema = authSchema.extend({ name: z.string().trim().min(3).optional() });

export async function POST(req: NextRequest) {
  let data;
  try { data = await profileJson(req, 16 * 1024); }
  catch { return NextResponse.json({ message: "Invalid JSON" }, { status: 400 }); }

  const parsed = registerSchema.safeParse(data);
  if (!parsed.success) return NextResponse.json({ message: parsed.error.errors[0].message }, { status: 400 });
  const email = parsed.data.email.trim().toLowerCase();
  try { assertTrustedWriteOrigin(req); await enforceAuthThrottle(req, "SIGNUP", email); } catch (error) { return profileErrorResponse(error); }
  const response = await auth.api.signUpEmail({
    body: { ...parsed.data, email, name: parsed.data.name || email.split("@")[0] },
    headers: req.headers,
    asResponse: true,
  });
  if (!response.ok) return response;
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return NextResponse.json(sanitizeUser(user), { status: 201, headers: response.headers });
}
