import type { EditorResume } from "@/lib/resume-editor";
import type { MatchingPreferences } from "@/lib/find-jobs/for-you";
import type { CandidatePreferences } from "@/lib/find-jobs/ranking";

/** A user-selected title guides discovery; the CV supplies real skills. */
export function candidateFromResume(resume: EditorResume, prefs: MatchingPreferences): CandidatePreferences {
  const resumeRole = resume.experiences.find(item => item.title.trim())?.title.trim() ||
    (/^(?:my resume|cv|resume|curriculum vitae)$/i.test(resume.title.trim()) ? "" : resume.title.trim());
  const title = resumeRole || prefs.title.trim();
  return {
    headline: title,
    targetJobTitle: prefs.title.trim() || title,
    // Imported CVs often demonstrate skills in projects and summaries rather
    // than in a dedicated skills field. All signals still come from this CV.
    skills: [
      ...resume.skills.flatMap(item => Object.values(item)),
      ...resume.summary,
      ...(resume.projects ?? []).flatMap(item => [item.title, item.technologies, item.description]),
      ...(resume.certifications ?? []).map(item => item.title),
      ...(resume.educations ?? []).map(item => item.degree),
    ].filter(Boolean).join(" ").slice(0, 12000),
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
