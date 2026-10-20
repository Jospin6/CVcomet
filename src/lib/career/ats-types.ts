export type AtsEvidence = { field: string; quote: string };
export type AtsIssue = {
  id: string; category: "PARSING" | "CONTENT" | "JOB_MATCH";
  severity: "critical" | "warning" | "info";
  title: string; reason: string; suggestion: string; evidence: AtsEvidence[];
  field?: string; design?: "layout" | "fontSize" | "lineHeight";
  proposedText?: string;
};
export type AtsCheck = {
  id: string; label: string; weight: number; earned: number | null;
  status: "PASS" | "PARTIAL" | "FAIL" | "NOT_ASSESSED";
  reason: string; evidence: AtsEvidence[];
};
export type PdfAudit = {
  status: "VERIFIED" | "NOT_PROVIDED"; score: number | null;
  pages: number; bytes: number; extractedCharacters: number; text: string;
  recovery: number | null; smallTextRatio: number; spacedHeadings: string[];
  checks: AtsCheck[]; issues: AtsIssue[];
};
export type SemanticReview = {
  status: "COMPLETE" | "UNAVAILABLE"; error?: string;
  contributions?: { field: string; actionQuote: string; methodQuote: string; outcomeQuote: string; outcomeType: "OBSERVED" | "TASK_ONLY" | "NOT_STATED" }[];
  skillEvidence?: { skill: string; status: "DEMONSTRATED" | "PARTIAL" | "UNSUPPORTED"; evidence: AtsEvidence[] }[];
  criteria: { id: "specificity" | "positioning" | "writing"; rating: number; reason: string; evidence: AtsEvidence[] }[];
  issues: AtsIssue[];
};
export type AtsJobMatch = {
  status: "NOT_PROVIDED" | "COMPLETE" | "UNAVAILABLE";
  score: number | null; error?: string;
  coverage?: number; range?: { min: number; max: number } | null;
  requirements: { title: string; priority: string; status: string; evidence: string; sources: AtsEvidence[] }[];
};
export type AtsAnalysis = {
  version: 2; rubricVersion: "2026-10-ats-v2"; fingerprint?: string;
  // An overall ATS acceptance percentage is deliberately not calculated.
  overallScore: null;
  targetJob?: { id: string; title: string; company: string | null; updatedAt: string };
  content: { score: number | null; assessedWeight: number; totalWeight: number; earned: number; checks: AtsCheck[]; limits: { max: number; reason: string }[] };
  technical: PdfAudit; jobMatch: AtsJobMatch;
  review: { status: SemanticReview["status"]; error?: string };
  keywords: { matched: string[]; missing: string[]; status: "NOT_PROVIDED" | "CHECKED" };
  strengths: string[]; issues: AtsIssue[];
};
