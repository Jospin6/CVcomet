import { z } from "zod";

export const resumeSections = ["summary", "experiences", "educations", "skills", "projects", "certifications", "languages"] as const;
export type ResumeSection = typeof resumeSections[number];
const text = (max: number) => z.string().max(max).default("");
const lines = z.array(z.string().max(8000)).max(30).default([]);
export const resumeContactSchema = z.object({ name: text(200), email: text(254), phone: text(80), city: text(300), linkedin: text(2048), website: text(2048) }).strict();
export const resumeDesignSchema = z.object({
  documentName: text(160), layout: z.enum(["modern", "classic", "minimal"]).default("modern"),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i).default("#173F35"),
  font: z.enum(["sans", "serif", "mono"]).default("sans"), fontSize: z.number().min(11).max(16).default(13),
  lineHeight: z.number().min(1.2).max(1.8).default(1.5), padding: z.number().min(28).max(64).default(44),
  sectionOrder: z.array(z.enum(resumeSections)).max(7).default([...resumeSections]),
  hiddenSections: z.array(z.enum(resumeSections)).max(7).default([]),
  fieldStyles: z.record(z.object({ bold: z.boolean().optional(), italic: z.boolean().optional(), underline: z.boolean().optional(), bullets: z.boolean().optional(), align: z.enum(["left", "center", "right"]).optional() }).strict()).default({}),
}).strict();
export const resumeContentSchema = z.object({
  title: text(160), summary: z.array(z.string().max(5000)).max(3).default([]),
  skills: z.array(z.object({ hardskills: text(8000), softskills: text(4000), tools: text(4000) }).strict()).max(30).default([]),
  experiences: z.array(z.object({ title: text(200), company: text(200), location: text(200), start: text(80), end: text(80), description: lines }).strict()).max(50).default([]),
  educations: z.array(z.object({ degree: text(200), school: text(200), location: text(200), start: text(80), end: text(80), description: lines }).strict()).max(50).default([]),
  projects: z.array(z.object({ title: text(200), description: text(8000), technologies: text(2000), link: text(2048) }).strict()).max(50).default([]),
  certifications: z.array(z.object({ title: text(200), issuer: text(200), date: text(80), description: text(4000) }).strict()).max(50).default([]),
  languages: z.array(z.object({ language: text(200), level: text(200) }).strict()).max(30).default([]),
  contact: resumeContactSchema.default({}), design: resumeDesignSchema.default({}),
}).strict();
export const resumePatchSchema = resumeContentSchema.partial().extend({ revision: z.number().int().nonnegative().optional() }).strict();
export type EditorResume = z.infer<typeof resumeContentSchema>;
export type ResumeDesign = EditorResume["design"];
export type ResumeUnit = { key: string; section: ResumeSection; index: number };
export type ResumePage = { main: ResumeUnit[]; side: ResumeUnit[] };
export const A4_WIDTH = 794, A4_HEIGHT = 1123;

export function normalizeEditorResume(value: Record<string, unknown>, fallback: Partial<EditorResume["contact"]> = {}): EditorResume {
  const content = Object.fromEntries(Object.keys(resumeContentSchema.shape).map(key => [key, value[key] ?? undefined]));
  if (!content.contact) content.contact = resumeContactSchema.parse(fallback);
  // Older generated records may have additional presentation properties.
  for (const key of ["skills", "experiences", "educations", "projects", "certifications", "languages"] as const) {
    const items = Array.isArray(content[key]) ? content[key] as Record<string, unknown>[] : [];
    const itemSchema = resumeContentSchema.shape[key]._def.innerType.element;
    content[key] = items.map(item => Object.fromEntries(Object.keys(itemSchema.shape).map(field => [field, item[field] ?? undefined])));
  }
  return resumeContentSchema.parse(content);
}

export function fieldValue(resume: EditorResume, path: string): string {
  let value: unknown = resume;
  for (const key of path.split(".")) {
    if (!value || typeof value !== "object") return "";
    value = (value as Record<string, unknown>)[key];
  }
  return Array.isArray(value) ? value.join("\n") : typeof value === "string" ? value : "";
}

export function resumeBulletItems(value: string | string[]): string[] {
  return (Array.isArray(value) ? value : [value]).flatMap(line => line.split(/\r?\n/))
    .map(line => line.replace(/^\s*(?:[•●▪◦‣*-]|\d+[.)])\s+/u, "").trim()).filter(Boolean);
}

export function resumeFieldSupportsBullets(path: string): boolean {
  return /^(?:summary\.\d+|(?:experiences|educations|projects|certifications)\.\d+\.description|skills\.\d+\.(?:hardskills|softskills|tools))$/.test(path);
}

export function resumeFieldHasBullets(resume: EditorResume, path: string): boolean {
  return resumeFieldSupportsBullets(path) && (resume.design.fieldStyles[path]?.bullets ?? /^experiences\.\d+\.description$/.test(path));
}

export function setResumeField(resume: EditorResume, path: string, textValue: string): EditorResume {
  const keys = path.split(".");
  if (keys.some(key => ["__proto__", "constructor", "prototype"].includes(key))) return resume;
  const next = structuredClone(resume);
  let target = next as unknown as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) {
    if (!target[key] || typeof target[key] !== "object") return resume;
    target = target[key] as Record<string, unknown>;
  }
  const key = keys.at(-1)!;
  if (Array.isArray(target[key])) target[key] = textValue.split("\n").map(line => line.trim()).filter(Boolean);
  else if (typeof target[key] === "string" || (Array.isArray(target) && keys[0] === "summary" && key === "0")) target[key] = textValue;
  else return resume;
  return next;
}

export function addResumeEntry(resume: EditorResume, section: ResumeSection): EditorResume {
  const next = structuredClone(resume);
  if (section === "summary") { if (!next.summary.length) next.summary = [""]; next.design.hiddenSections = next.design.hiddenSections.filter(key => key !== section); return next; }
  const schema = resumeContentSchema.shape[section]._def.innerType.element;
  (next[section] as unknown[]).push(schema.parse({}));
  next.design.hiddenSections = next.design.hiddenSections.filter(key => key !== section);
  return next;
}

export function orderedSections(design: ResumeDesign) {
  return [...new Set([...design.sectionOrder, ...resumeSections])].filter(key => !design.hiddenSections.includes(key));
}
export function moveResumeSection(design: ResumeDesign, section: ResumeSection, to: number): ResumeDesign {
  const order = [...new Set([...design.sectionOrder, ...resumeSections])];
  order.splice(order.indexOf(section), 1); order.splice(Math.max(0, Math.min(to, order.length)), 0, section);
  return { ...design, sectionOrder: order };
}
export function resumeUnits(resume: EditorResume, includeEmpty = true): ResumeUnit[] {
  return orderedSections(resume.design).flatMap(section => {
    const items = resume[section];
    if (!items.length) return includeEmpty ? [{ key: section + ":empty", section, index: -1 }] : [];
    return items.map((_, index) => ({ key: section + ":" + index, section, index })).filter(unit => includeEmpty || hasResumeUnitContent(resume, unit));
  });
}
export function hasResumeUnitContent(resume: EditorResume, unit: ResumeUnit) {
  if (unit.index < 0) return false;
  const entry = resume[unit.section][unit.index];
  if (typeof entry === "string") return Boolean(entry.trim());
  return entry && Object.values(entry).some(value => Array.isArray(value) ? value.some(line => line.trim()) : value.trim());
}
export function isSidebarSection(section: ResumeSection, design: ResumeDesign) {
  return design.layout === "modern" && ["skills", "languages", "certifications"].includes(section);
}

export function paginateResume(resume: EditorResume, heights: Record<string, number>, headerHeight: number, continuationHeaderHeight = 72, includeEmpty = true): ResumePage[] {
  const units = resumeUnits(resume, includeEmpty);
  const capacity = A4_HEIGHT - resume.design.padding * 2 - 34;
  const paginate = (items: ResumeUnit[], sidebar = false) => {
    const columnCapacity = capacity - (sidebar ? 32 : 0);
    const pages: ResumeUnit[][] = [[]]; let used = 0, available = columnCapacity - headerHeight;
    for (const unit of items) {
      let page = pages.at(-1)!;
      const heading = page.at(-1)?.section !== unit.section ? 35 : 0;
      const height = (heights[unit.key] || 64) + heading;
      if (page.length && used + height > available) { pages.push([]); page = pages.at(-1)!; used = 0; available = columnCapacity - continuationHeaderHeight; }
      used += (heights[unit.key] || 64) + (page.at(-1)?.section !== unit.section ? 35 : 0);
      page.push(unit);
    }
    return pages;
  };
  const main = paginate(units.filter(unit => !isSidebarSection(unit.section, resume.design)));
  const side = paginate(units.filter(unit => isSidebarSection(unit.section, resume.design)), true);
  return Array.from({ length: Math.max(main.length, side.length) }, (_, index) => ({ main: main[index] || [], side: side[index] || [] }));
}

export function tintAccent(hex: string) {
  return "#" + [1, 3, 5].map(offset => Math.round(parseInt(hex.slice(offset, offset + 2), 16) * .06 + 255 * .94).toString(16).padStart(2, "0")).join("");
}
export const resumeFonts = { sans: "Arial, Helvetica, sans-serif", serif: "Georgia, 'Times New Roman', serif", mono: "'Courier New', monospace" };
export function safeResumeLink(value: string) {
  const candidate = /^https?:\/\//i.test(value) ? value : "https://" + value;
  try { const url = new URL(candidate); return /^https?:$/.test(url.protocol) && !url.username && !url.password ? candidate : ""; } catch { return ""; }
}
