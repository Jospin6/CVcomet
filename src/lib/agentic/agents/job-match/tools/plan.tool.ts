import { validateJobAnalysis } from "@/lib/career/job-match";
import type { JobAnalysis } from "@/lib/career/job-schema";

/** Reject stale/malformed posting citations; re-extract and reserve quota in the
 * HTTP route when the stored analysis no longer matches the job text. */
export function validateSavedJobAnalysis(saved: unknown, description: string): JobAnalysis | null {
  if (!saved) return null;
  try { return validateJobAnalysis(saved, description); }
  catch { return null; }
}
