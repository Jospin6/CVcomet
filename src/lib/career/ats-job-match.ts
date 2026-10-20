import type { EditorResume } from "@/lib/resume-editor";
import type { MatchResult } from "./job-schema";
import { atsEvidence, atsWorkEvidence, containsAtsTerm } from "./ats-text";
import type { AtsJobMatch } from "./ats-types";

/** Verified criteria remain separate from missing and uncertain evidence.
 * Unknown requirements produce a range, never a deceptively complete score. */
export function assessAtsJobMatch(resume: EditorResume, baseline: MatchResult): AtsJobMatch {
  const all = atsEvidence(resume);
  const work = atsWorkEvidence(resume).filter(item => item.quote.split(/\s+/).length >= 6);
  const uncertain = (text: string) => /\b(?:no experience|not proficient|learning|seeking|aspiring|interested in|sans experience|en apprentissage|souhaite apprendre)\b/i.test(text.normalize("NFKD").replace(/\p{M}/gu, ""));
  let total = 0, points = 0, unknown = 0;
  const requirements = baseline.requirements.map(requirement => {
    let status = requirement.status;
    let sources = requirement.evidenceSources.map(source => ({ field: source.path.replace(/^cv\./, ""), quote: source.quote }));
    if (requirement.category === "TECHNICAL") {
      sources = work.filter(source => requirement.terms.some(term => containsAtsTerm(source.quote, term)));
      const demonstrated = requirement.terms.every(term => sources.some(source => containsAtsTerm(source.quote, term)));
      const claimed = requirement.terms.some(term => all.some(source => containsAtsTerm(source.quote, term)));
      status = requirement.ambiguity || sources.some(source => uncertain(source.quote)) ? "VERIFY" : demonstrated ? "DEMONSTRATED" : sources.length ? "PARTIAL" : claimed ? "VERIFY" : "NOT_DEMONSTRATED";
    }
    const weight = requirement.priority === "REQUIRED" ? 3 : requirement.priority === "PREFERRED" ? 1 : .25;
    total += weight;
    if (status === "VERIFY") unknown += weight;
    else points += weight * (status === "DEMONSTRATED" ? 1 : status === "PARTIAL" ? .5 : 0);
    return { title: requirement.title, priority: requirement.priority, status, evidence: requirement.evidence, sources };
  });
  const min = total ? Math.round(points / total * 100) : 0, max = total ? Math.round((points + unknown) / total * 100) : 0;
  return { status: "COMPLETE", score: total && unknown === 0 ? min : null, coverage: total ? Math.round((total - unknown) / total * 100) : 0, range: total ? { min, max } : null, requirements };
}
