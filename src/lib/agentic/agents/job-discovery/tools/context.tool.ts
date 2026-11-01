import type { EditorResume } from "@/lib/resume-editor";
import type { MatchingPreferences } from "@/lib/find-jobs/for-you";
import type { CandidatePreferences } from "@/lib/find-jobs/ranking";

/** A user-selected title guides discovery; the CV supplies real skills. */
export function candidateFromResume(resume: EditorResume, prefs: MatchingPreferences): CandidatePreferences {
  const title = prefs.title.trim() || resume.experiences[0]?.title?.trim() || resume.title.trim();
  return {
    headline: title,
    targetJobTitle: title,
    skills: resume.skills.flatMap(item => Object.values(item)).filter(Boolean).join(" ").slice(0, 6000),
    experiences: resume.experiences.slice(0, 12).map(({ title, description }) => ({
      // A career pivot targets the desired role; past roles remain skills evidence.
      title: prefs.title.trim() ? "" : title,
      description: description.join(" ").slice(0, 1500),
    })),
    preferredWorkMode: prefs.workplaces.length === 1 ? prefs.workplaces[0] : "",
    targetCountry: prefs.countries.length === 1 ? prefs.countries[0] : "",
    experienceLevel: prefs.seniorities.length === 1 ? prefs.seniorities[0] : "",
  };
}
