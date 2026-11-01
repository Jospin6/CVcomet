import type { MatchResult, RequirementResult, ResumePreparationAction } from "@/lib/career/job-schema";
import { RESUME_ACTION_WORDING } from "../prompts/improvements.prompt";

type ResumeActionKind = ResumePreparationAction["kind"];
const priorityRank = { REQUIRED: 0, PREFERRED: 1, MENTIONED: 2 } as const;
const statusRank = { VERIFY: 0, NOT_DEMONSTRATED: 1, PARTIAL: 2, DEMONSTRATED: 3 } as const;

/** Read-only preparation for existing /api/tailor-resume PROPOSE -> ACCEPT.
 * Neither this tool nor the graph invokes the Resume Agent or edits the CV. */
export function prepareResumeActions(match: MatchResult, language: "fr" | "en"): ResumePreparationAction[] {
  return [...match.requirements]
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] ||
      statusRank[a.status] - statusRank[b.status] || a.id.localeCompare(b.id))
    .flatMap(item => {
      const cv = item.evidenceSources.filter(x => /^cv\./.test(x.path));
      const profile = item.evidenceSources.filter(x => /^profile\./.test(x.path));
      if (item.status === "DEMONSTRATED" && (cv.length || !profile.length)) return [];
      const kind: ResumeActionKind = match.source === "PROFILE" ? "SELECT_RESUME"
        : item.status === "VERIFY" ? "VERIFY_FACTS"
        : profile.length && !cv.length ? "BRING_PROFILE_EVIDENCE"
        : cv.length ? "REINFORCE_CV" : "REVIEW_GAP";
      return [{ requirementId: item.id, title: item.title, status: item.status,
        priority: item.priority, kind, nextStep: RESUME_ACTION_WORDING[language][kind],
        evidencePaths: [...new Set(item.evidenceSources.map(x => x.path))].slice(0, 4),
        requiresApproval: true as const }];
    }).slice(0, 12);
}

