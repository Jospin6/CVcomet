import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/career/auth-user";
import { apiError } from "@/lib/career/api";
import { readJobPDF } from "@/lib/career/job-input";
import { scrapeJobUrl, JobScrapeError } from "@/lib/career/job-scraper";
import { profileJson } from "@/lib/career-profile/http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    await requireUser();
    if (req.headers.get("content-type")?.startsWith("multipart/form-data")) return NextResponse.json(await readJobPDF(req));
    const { url } = z.object({ url: z.string().url().max(2048) }).strict().parse(await profileJson(req));
    const job = await scrapeJobUrl(url);
    const text = [job.title, job.company, job.location, job.description].filter(Boolean).join("\n\n");
    if (text.length > 50000) throw new JobScrapeError(413, "JOB_TOO_LONG", "The offer exceeds 50,000 characters. Paste only the relevant text.");
    return NextResponse.json({ text, source: { type: "URL", url: job.url, originalText: text } });
  } catch (error) {
    if (error instanceof JobScrapeError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return apiError(error);
  }
}
