import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getCareerProfile, saveCareerProfile } from "@/lib/career-profile/service";
import { saveProfileSchema } from "@/lib/career-profile/schema";
import { ProfileError, profileErrorResponse, profileJson } from "@/lib/career-profile/http";

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) throw new ProfileError(401, "UNAUTHORIZED");
    return NextResponse.json(await getCareerProfile(session.id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return profileErrorResponse(error); }
}
export async function PUT(req: Request) {
  try {
    const session = await getSessionUser();
    if (!session) throw new ProfileError(401, "UNAUTHORIZED");
    const { profile, revision, completeOnboarding } = saveProfileSchema.parse(await profileJson(req));
    return NextResponse.json(await saveCareerProfile(session.id, profile, revision, completeOnboarding));
  } catch (error) { return profileErrorResponse(error); }
}
