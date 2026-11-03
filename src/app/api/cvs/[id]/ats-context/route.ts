import { NextResponse } from "next/server";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";
import { resumeSourceJob } from "@/lib/career/resume-source-job";
import { findResumeApplications } from "@/lib/career/ats-application-context";
import { savedJobTitle } from "@/lib/career/job-opportunities";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const applications = await findResumeApplications(user.id, id);
    const choices = applications.map(item => ({
      id: item.id, jobTitle: item.jobTitle, company: item.company,
      hasJobDescription: Boolean(item.job?.userId === user.id && item.job.description?.trim().length >= 100),
      hasCoverLetter: Boolean(item.coverLetter?.conversation.userId === user.id &&
        (!item.coverLetter.cvId || item.coverLetter.cvId === id) &&
        (!item.coverLetter.jobId || item.coverLetter.jobId === item.jobId)),
    }));
    // Do not create a job record when an application already provides the posting.
    const source = applications.length ? null : await resumeSourceJob(user.id, id);
    const job = source?.job;
    return NextResponse.json({
      applications: choices,
      job: job ? { id: job.id, title: savedJobTitle(job), company: job.company,
        location: job.location, createdAt: job.createdAt, updatedAt: job.updatedAt } : null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
