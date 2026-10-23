import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { jobCoverLetter } from "@/lib/career/job-documents";
import { ProfileError, profileErrorResponse, profileJson } from "@/lib/career-profile/http";

export const maxDuration = 60;

/** Compatibility endpoint for the job-analysis flow. */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ProfileError(401, "UNAUTHORIZED");
    const input = await profileJson(req);
    if (!input || typeof input !== "object" || !("jobId" in input) || !("cvId" in input)) throw new ProfileError(422, "CV_JOB_REQUIRED");
    return NextResponse.json(await jobCoverLetter(user.id, input));
  } catch (error) { return profileErrorResponse(error); }
}
