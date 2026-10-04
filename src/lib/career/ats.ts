type ResumeLike = { title?: string; summary?: string[] | string | null; skills?: unknown; experiences?: unknown; educations?: unknown; certifications?: unknown; projects?: unknown; languages?: unknown };
const arr = (v: unknown) => Array.isArray(v) ? v : [];
const clamp = (n:number) => Math.max(0, Math.min(100, Math.round(n)));
export function analyzeResume(resume: ResumeLike, keywords: string[] = []) {
  const summary = Array.isArray(resume.summary) ? resume.summary.join(" ") : resume.summary || "";
  const experiences = arr(resume.experiences); const skills = arr(resume.skills); const education = arr(resume.educations);
  const raw = JSON.stringify(resume).toLowerCase();
  const keywordHits = keywords.filter(k => raw.includes(k.toLowerCase())).length;
  const keywordScore = keywords.length ? clamp(keywordHits / keywords.length * 100) : 72;
  const structure = clamp(35 + (resume.title ? 15:0) + (summary ? 15:0) + (experiences.length ? 20:0) + (skills.length ? 15:0));
  const contact = 80; const experience = clamp(35 + experiences.length * 18); const skillScore = clamp(35 + skills.length * 18);
  const readability = clamp(90 - Math.max(0, raw.length - 12000) / 300); const formatting = 88;
  const impact = clamp(45 + ((raw.match(/\b\d+%?|\$\d+|\d+\+/g)||[]).length * 8)); const grammar = 88;
  const overall = clamp((structure + contact + experience + skillScore + keywordScore + readability + formatting + impact + grammar) / 9);
  const strengths:string[]=[]; const issues:{severity:"critical"|"warning"|"info";title:string;reason:string;suggestion:string}[]=[];
  if (structure >= 80) strengths.push("Core resume sections are present and easy to identify."); else issues.push({severity:"critical",title:"Incomplete structure",reason:"Important resume sections are missing or too thin.",suggestion:"Add a focused headline, summary, experience and skills section."});
  if (impact >= 70) strengths.push("Experience includes measurable impact."); else issues.push({severity:"warning",title:"Impact can be clearer",reason:"Few quantified outcomes were detected.",suggestion:"Add verified numbers only where you can support them."});
  if (keywordScore < 65) issues.push({severity:"warning",title:"Keyword alignment is low",reason:"The resume does not reflect enough verified job terminology.",suggestion:"Use relevant job keywords only when they match your real experience."});
  return { overallScore: overall, structureScore: structure, formattingScore: formatting, readabilityScore: readability, contactScore: contact, experienceScore: experience, skillsScore: skillScore, keywordScore, impactScore: impact, grammarScore: grammar, strengths, issues };
}
