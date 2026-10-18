import { NextResponse } from "next/server";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";
import { tailorJobResume } from "@/lib/career/job-tailor";
import { profileJson } from "@/lib/career-profile/http";
export const maxDuration = 60;
export async function POST(req: Request) {
  try { const user = await requireUser(); return NextResponse.json(await tailorJobResume(user.id, await profileJson(req))); }
  catch (error) { return apiError(error); }
}
