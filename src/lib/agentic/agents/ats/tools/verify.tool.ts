import type { AtsAnalysis } from "@/lib/career/ats-types";

/** Defensive output validation: scores belong to the existing deterministic rubric. */
export function verifyAtsReport(report: AtsAnalysis): void {
  if (report.version !== 2 || report.rubricVersion !== "2026-10-ats-v2" || report.overallScore !== null) {
    throw new Error("ATS_INVALID_REPORT");
  }
  if ((report.review.status !== "COMPLETE" && report.content.score !== null) ||
      (report.jobMatch.status !== "COMPLETE" && report.jobMatch.score !== null)) {
    throw new Error("ATS_UNVERIFIED_SCORE");
  }
  for (const score of [report.content.score, report.technical.score, report.jobMatch.score]) {
    if (score !== null && (!Number.isFinite(score) || score < 0 || score > 100)) {
      throw new Error("ATS_SCORE_OUT_OF_RANGE");
    }
  }
  if (!Array.isArray(report.issues) || report.issues.length > 500 ||
      report.issues.some(issue => !["CONTENT", "PARSING", "JOB_MATCH"].includes(issue.category) ||
        !["critical", "warning", "info"].includes(issue.severity) ||
        typeof issue.suggestion !== "string" || !issue.suggestion.trim())) {
    throw new Error("ATS_INVALID_ISSUES");
  }
}
