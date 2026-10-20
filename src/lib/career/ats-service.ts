import { getAIModel } from "@/lib/ai/model";
import { reserveProfileAI } from "@/lib/career-profile/ai";
import { ProfileError, profileAIError } from "@/lib/career-profile/http";
import { emptyProfile } from "@/lib/career-profile/schema";
import type { EditorResume } from "@/lib/resume-editor";
import { analyzeResume } from "./ats";
import { visibleAtsResume } from "./ats-text";
import { reviewAtsContent } from "./ats-review";
import { analyzeJobDescription, matchJob, validateJobAnalysis } from "./job-match";
import { assessAtsJobMatch } from "./ats-job-match";
import type { AtsJobMatch, PdfAudit, SemanticReview } from "./ats-types";

const code = (error: unknown) => error instanceof ProfileError ? error.code : profileAIError(error).code;

export async function assessAtsResume({ userId, resume, keywords = [], language = "en", document, jobDescription = "", jobAnalysis }: {
  userId: string; resume: EditorResume; keywords?: string[]; language?: "fr" | "en"; document?: PdfAudit; jobDescription?: string; jobAnalysis?: unknown;
}) {
  const visible = visibleAtsResume(resume);
  let semantic: SemanticReview = { status: "UNAVAILABLE", error: "AI_UNAVAILABLE", criteria: [], issues: [] };
  let jobMatch: AtsJobMatch = { status: jobDescription ? "UNAVAILABLE" : "NOT_PROVIDED", score: null, requirements: [] };
  let savedAnalysis;
  if (jobDescription && jobAnalysis) {
    try { savedAnalysis = validateJobAnalysis(jobAnalysis, jobDescription); }
    catch { /* Older or invalid source citations require a fresh extraction. */ }
  }
  if (savedAnalysis) jobMatch = assessAtsJobMatch(visible, matchJob(emptyProfile(), savedAnalysis, visible));
  try {
    const model = await getAIModel({ structuredOutputs: true });
    await reserveProfileAI(userId);
    const [review, match] = await Promise.allSettled([
      reviewAtsContent(visible, language, model),
      jobDescription && !savedAnalysis ? analyzeJobDescription(jobDescription, undefined, language, model).then(job => {
        // Match only the visible CV. Central profile facts must not rescue an
        // omission in the document that will actually be submitted.
        const result = matchJob(emptyProfile(), job, visible);
        return assessAtsJobMatch(visible, result);
      }) : Promise.resolve(jobMatch),
    ]);
    semantic = review.status === "fulfilled" ? review.value : { status: "UNAVAILABLE", error: code(review.reason), criteria: [], issues: [] };
    jobMatch = match.status === "fulfilled" ? match.value : { status: "UNAVAILABLE", score: null, error: code(match.reason), requirements: [] };
  } catch (error) {
    const errorCode = code(error);
    semantic.error = errorCode;
    if (jobDescription && !savedAnalysis) jobMatch.error = errorCode;
  }
  const report = analyzeResume(resume, keywords, language, { document, semantic, jobMatch });
  for (const [index, requirement] of jobMatch.requirements.entries()) {
    if (requirement.status === "DEMONSTRATED") continue;
    report.issues.push({ id: `job-${index}`, category: "JOB_MATCH", severity: requirement.priority === "REQUIRED" && requirement.status === "NOT_DEMONSTRATED" ? "critical" : "warning", title: requirement.title,
      reason: language === "fr" ? "Le CV ne démontre pas complètement cette exigence de l’offre, ou une vérification est nécessaire." : "The resume does not fully demonstrate this job requirement, or verification is needed.",
      suggestion: language === "fr" ? "Vérifiez cette exigence et ajoutez une preuve concrète uniquement si votre parcours la justifie." : "Review this requirement and add concrete evidence only if your actual background supports it.",
      evidence: [{ field: "job", quote: requirement.evidence }, ...requirement.sources], field: requirement.sources[0]?.field ?? (visible.projects.length ? "projects.0.description" : "experiences.0.description") });
  }
  return report;
}
