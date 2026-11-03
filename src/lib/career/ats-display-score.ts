import type { AtsAnalysis } from "./ats-types";

export type AtsDisplayScore = {
  score: number | null;
  kind: "job" | "content" | "verified" | "none";
  assessedWeight: number;
};

/** Display-only figure. Never persist the verified-check percentage as a full
 * semantic quality score or as an ATS acceptance probability. */
export function atsDisplayScore(report: AtsAnalysis): AtsDisplayScore {
  if (report.jobMatch.status === "COMPLETE" && report.jobMatch.score !== null) {
    return { score: report.jobMatch.score, kind: "job", assessedWeight: 100 };
  }
  if (report.content.score !== null) {
    return { score: report.content.score, kind: "content", assessedWeight: 100 };
  }
  const assessedWeight = report.content.checks.filter(check => check.earned !== null)
    .reduce((sum, check) => sum + check.weight, 0);
  const earned = report.content.checks.reduce((sum, check) => sum + (check.earned ?? 0), 0);
  if (assessedWeight <= 0) return { score: null, kind: "none", assessedWeight: 0 };
  return {
    score: Math.max(0, Math.min(100, Math.round(earned / assessedWeight * 100))),
    kind: "verified", assessedWeight,
  };
}
