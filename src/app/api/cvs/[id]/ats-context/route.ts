import { NextResponse } from "next/server";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";
import { resumeSourceJob } from "@/lib/career/resume-source-job";
import { savedJobTitle } from "@/lib/career/job-opportunities";

// Resolving an older generated CV may register its original posting in the
// catalog, so this explicit initialization uses POST rather than mutating GET.
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { job, origin } = await resumeSourceJob(user.id, id);
    return NextResponse.json({ origin, job: job ? { id: job.id, title: savedJobTitle(job), company: job.company, location: job.location, createdAt: job.createdAt, updatedAt: job.updatedAt } : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
