import { fieldValue, hasResumeUnitContent, resumeSections, type EditorResume } from "@/lib/resume-editor";
import type { AtsEvidence } from "./ats-types";

export const normalizeAtsText = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
  .replace(/\breact[.\s-]?js\b/g, "react").replace(/\bnext[.\s-]?js\b/g, "nextjs")
  .replace(/\bnode[.\s-]?js\b/g, "nodejs").replace(/\bfast[.\s-]?api\b/g, "fastapi")
  .replace(/\bpostgres(?:ql)?\b/g, "postgresql").replace(/\bjs\b/g, "javascript")
  .replace(/\bts\b/g, "typescript").replace(/\.net\b/g, "dotnet").replace(/\s+/g, " ").trim();
export function containsAtsTerm(text: string, term: string) {
  const escaped = normalizeAtsText(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Boolean(escaped) && new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "u").test(normalizeAtsText(text));
}
export function visibleAtsResume(resume: EditorResume): EditorResume {
  const next = structuredClone(resume);
  for (const section of next.design.hiddenSections) next[section] = [];
  return next;
}
export function atsEvidence(resume: EditorResume): AtsEvidence[] {
  const evidence: AtsEvidence[] = [];
  const add = (field: string) => { const quote = fieldValue(resume, field).trim(); if (quote) evidence.push({ field, quote }); };
  add("title");
  for (const key of Object.keys(resume.contact)) add(`contact.${key}`);
  for (const section of resumeSections) {
    if (resume.design.hiddenSections.includes(section)) continue;
    resume[section].forEach((entry, index) => {
      if (!hasResumeUnitContent(resume, { section, index, key: "" })) return;
      if (typeof entry === "string") add(`${section}.${index}`);
      else for (const key of Object.keys(entry)) add(`${section}.${index}.${key}`);
    });
  }
  return evidence;
}
export function atsWorkEvidence(resume: EditorResume) {
  return atsEvidence(resume).filter(item => /^(experiences|projects)\.\d+\.description$/.test(item.field));
}
export function atsClaimedSkills(resume: EditorResume) {
  const visible = visibleAtsResume(resume);
  return [...new Map(visible.skills.flatMap((entry, index) => ["hardskills", "tools"].flatMap(key => entry[key as "hardskills" | "tools"].split(/[,;|\n•]+/).map(term => ({ term: term.trim(), field: `skills.${index}.${key}` }))))
    .filter(item => item.term).map(item => [normalizeAtsText(item.term), item])).values()];
}
export function parseAtsDate(value: string): { start: number; end: number } | null {
  const text = value.trim();
  let year: number, month: number | undefined, day: number | undefined;
  let match = /^(\d{4})(?:[-/](\d{1,2})(?:[-/](\d{1,2}))?)?$/.exec(text);
  if (match) { year = Number(match[1]); month = match[2] ? Number(match[2]) : undefined; day = match[3] ? Number(match[3]) : undefined; }
  else {
    match = /^(?:(\d{1,2})[-/])?(\d{1,2})[-/](\d{4})$/.exec(text);
    if (match) { year = Number(match[3]); month = Number(match[2]); day = match[1] ? Number(match[1]) : undefined; }
    else {
      const normalized = normalizeAtsText(text).replace(/\./g, "");
      const named = /^([a-z]+)\s+(\d{4})$/.exec(normalized);
      const months = [["jan", "january", "janvier"], ["feb", "february", "fevrier", "fev"], ["mar", "march", "mars"], ["apr", "april", "avril", "avr"], ["may", "mai"], ["jun", "june", "juin"], ["jul", "july", "juillet", "juil"], ["aug", "august", "aout"], ["sep", "sept", "september", "septembre"], ["oct", "october", "octobre"], ["nov", "november", "novembre"], ["dec", "december", "decembre"]];
      if (!named) return null;
      month = months.findIndex(names => names.includes(named[1])) + 1; year = Number(named[2]);
    }
  }
  if (year < 1900 || year > 2200 || month !== undefined && (month < 1 || month > 12) || day !== undefined && (day < 1 || day > new Date(Date.UTC(year, month!, 0)).getUTCDate())) return null;
  return { start: Date.UTC(year, (month ?? 1) - 1, day ?? 1), end: day ? Date.UTC(year, month! - 1, day) : month ? Date.UTC(year, month, 0) : Date.UTC(year, 11, 31) };
}
export const ongoingAtsDate = (value: string) => /^(present|current|ongoing|now|aujourd['’]hui|a ce jour|en cours|actuel(?:lement)?)$/i.test(normalizeAtsText(value));
