import { visibleAtsResume } from "@/lib/career/ats-text";
import { validateJobAnalysis } from "@/lib/career/job-match";
import type { AtsAgentInput, AtsPlan } from "../agent/state";

/** Saved job requirements must be revalidated against the exact job advert. */
export function planAtsAnalysis(input: AtsAgentInput): AtsPlan {
  const visible = visibleAtsResume(input.resume);
  const jobDescription = input.jobDescription?.trim() ?? "";
  if (!jobDescription) return { visible, jobMode: "none", savedAnalysis: null };
  if (input.jobAnalysis) {
    try {
      const savedAnalysis = validateJobAnalysis(input.jobAnalysis, jobDescription);
      return { visible, jobMode: "saved", savedAnalysis };
    } catch { /* Invalid or obsolete citations => extract the job again. */ }
  }
  return { visible, jobMode: "extract", savedAnalysis: null };
}
