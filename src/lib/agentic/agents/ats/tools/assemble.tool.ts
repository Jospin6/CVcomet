import { analyzeResume } from "@/lib/career/ats";
import type { EditorResume } from "@/lib/resume-editor";
import type { AtsAgentInput } from "../agent/state";
import type { AtsAnalysis, AtsJobMatch, SemanticReview } from "@/lib/career/ats-types";

/** Assemble with the existing deterministic rubric, never model-provided scores. */
export function assembleAtsReport(input: AtsAgentInput, visible: EditorResume, semantic: SemanticReview, jobMatch: AtsJobMatch): AtsAnalysis {
  const language = input.language ?? "en";
  const report = analyzeResume(input.resume, input.keywords ?? [], language, { document: input.document, semantic, jobMatch });
  for (const [index, requirement] of jobMatch.requirements.entries()) {
    if (requirement.status === "DEMONSTRATED") continue;
    report.issues.push({
      id: `job-${index}`, category: "JOB_MATCH",
      severity: requirement.priority === "REQUIRED" && requirement.status === "NOT_DEMONSTRATED" ? "critical" : "warning",
      title: requirement.title,
      reason: language === "fr"
        ? "Le CV ne démontre pas complètement cette exigence de l’offre, ou une vérification est nécessaire."
        : "The resume does not fully demonstrate this job requirement, or verification is needed.",
      suggestion: language === "fr"
        ? "Vérifiez cette exigence et ajoutez une preuve concrète uniquement si votre parcours la justifie."
        : "Review this requirement and add concrete evidence only if your actual background supports it.",
      evidence: [{ field: "job", quote: requirement.evidence }, ...requirement.sources],
      field: requirement.sources[0]?.field ?? (visible.projects.length ? "projects.0.description" : "experiences.0.description"),
    });
  }
  // Preserve client report contract. The PDF and the job remain independent signals.
  return report;
}
