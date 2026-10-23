/**
 * The catalogue is deliberately data-only.  A template never owns candidate
 * data or executable code; the editor applies its validated visual preset to
 * the normalised resume document.
 */
export type DocumentKind = "CV" | "COVER_LETTER";
export type ResumeFunctionalType = "REVERSE_CHRONOLOGICAL" | "SKILLS_BASED" | "HYBRID" | "STUDENT" | "ACADEMIC" | "EXECUTIVE" | "PORTFOLIO";
export type TemplateLayout = "modern" | "classic" | "minimal";

export type TemplateDefinition = {
  id: string; version: 1; name: string; type: DocumentKind; family: string;
  functionalType: ResumeFunctionalType | "COVER_LETTER"; layout: TemplateLayout;
  composition: string; style: string; accent: string; font: "sans" | "serif" | "mono";
  countries: string[]; languages: string[]; atsFriendly: boolean; photo: boolean;
  paper: "A4" | "LETTER"; keywords: string[]; matchingTemplateId?: string;
};

const families = [
  ["Executive Classic", "classic", "#27364A", "serif"], ["Modern Corporate", "modern", "#173F35", "sans"],
  ["Editorial Minimal", "minimal", "#262626", "serif"], ["Swiss Typography", "minimal", "#C23B22", "sans"],
  ["Elegant Serif", "classic", "#6B4F3A", "serif"], ["Clean Sans", "minimal", "#1E4B8F", "sans"],
  ["Premium Monochrome", "classic", "#111827", "sans"], ["Contemporary Grid", "modern", "#176B87", "sans"],
  ["Creative Accent", "modern", "#9B3A63", "sans"], ["Architectural Layout", "minimal", "#52525B", "mono"],
  ["Technical Professional", "modern", "#245B74", "mono"], ["Academic Formal", "classic", "#3F4C36", "serif"],
  ["Graduate Clean", "minimal", "#2D6A4F", "sans"], ["Nordic Minimal", "minimal", "#486A7A", "sans"],
  ["French Classic", "classic", "#1E3A5F", "serif"], ["American Professional", "minimal", "#173F35", "sans"],
  ["Canadian Professional", "modern", "#9A3D32", "sans"], ["British Modern", "classic", "#2F4858", "sans"],
  ["Modern Sidebar", "modern", "#5A4A42", "sans"], ["Compact Professional", "minimal", "#374151", "sans"],
  ["Luxury Editorial", "classic", "#5B3E2B", "serif"], ["Bold Typography", "minimal", "#9A3412", "sans"],
  ["Soft Neutral", "modern", "#63736B", "sans"], ["Geometric Minimal", "minimal", "#315C73", "sans"],
  ["Structured Two Column", "modern", "#334E68", "sans"], ["Traditional Single Column", "classic", "#4B5563", "serif"],
  ["Modern Timeline", "modern", "#0F766E", "sans"], ["Contemporary Header", "minimal", "#7C3AED", "sans"],
  ["Professional Accent", "modern", "#B45309", "sans"], ["Portfolio Resume", "modern", "#BE185D", "sans"],
] as const;

export const resumeFunctionalTypes: { id: ResumeFunctionalType; label: string }[] = [
  { id: "REVERSE_CHRONOLOGICAL", label: "Reverse chronological" }, { id: "SKILLS_BASED", label: "Skills-based" },
  { id: "HYBRID", label: "Hybrid" }, { id: "STUDENT", label: "Student / Junior" }, { id: "ACADEMIC", label: "Academic" },
  { id: "EXECUTIVE", label: "Executive" }, { id: "PORTFOLIO", label: "Creative / Portfolio" },
];

export const countryProfiles = [
  "US", "CANADA", "UK", "FRANCE", "GERMANY", "EUROPASS", "DRC", "AFRICA_FRANCOPHONE", "AFRICA_ANGLOPHONE", "SOUTH_AFRICA", "GULF", "INTERNATIONAL",
] as const;

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const makeResume = (functionalType: ResumeFunctionalType, family: typeof families[number], index: number): TemplateDefinition => ({
  id: `cv-${functionalType.toLowerCase()}-${String(index + 1).padStart(2, "0")}`,
  version: 1, name: `${family[0]} ${index + 1}`, type: "CV", functionalType, family: family[0], layout: family[1] as TemplateLayout,
  composition: `composition-${String(index + 1).padStart(2, "0")}`, style: index % 3 === 0 ? "Professional" : index % 3 === 1 ? "Modern" : "Minimal",
  accent: family[2], font: family[3] as "sans" | "serif" | "mono", countries: index % 5 === 0 ? ["US", "CANADA", "INTERNATIONAL"] : index % 5 === 1 ? ["FRANCE", "GERMANY", "EUROPASS"] : ["UK", "DRC", "AFRICA_FRANCOPHONE", "AFRICA_ANGLOPHONE", "INTERNATIONAL"],
  languages: ["fr", "en"], atsFriendly: ![8, 20, 29].includes(index), photo: [8, 29].includes(index), paper: index % 5 === 0 ? "LETTER" : "A4",
  keywords: [functionalType.toLowerCase(), family[0].toLowerCase(), "international", index % 2 ? "developer" : "business"], matchingTemplateId: `letter-${slug(family[0])}`,
});
const makeLetter = (family: typeof families[number], index: number): TemplateDefinition => ({
  id: `letter-${slug(family[0])}`, version: 1, name: `${family[0]} Letter`, type: "COVER_LETTER", functionalType: "COVER_LETTER", family: family[0], layout: family[1] as TemplateLayout,
  composition: `letter-${String(index + 1).padStart(2, "0")}`, style: index % 2 ? "Modern" : "Formal", accent: family[2], font: family[3] as "sans" | "serif" | "mono",
  countries: [...countryProfiles], languages: ["fr", "en"], atsFriendly: true, photo: false, paper: index % 5 === 0 ? "LETTER" : "A4",
  keywords: ["cover letter", "application", family[0].toLowerCase(), "email"], matchingTemplateId: `cv-reverse_chronological-${String(index + 1).padStart(2, "0")}`,
});

export const templateCatalog: TemplateDefinition[] = [
  ...resumeFunctionalTypes.flatMap(({ id }) => families.map((family, index) => makeResume(id, family, index))),
  ...families.map(makeLetter),
];
export const catalogById = new Map(templateCatalog.map(template => [template.id, template]));
export const catalogCounts = { cvs: templateCatalog.filter(item => item.type === "CV").length, coverLetters: templateCatalog.filter(item => item.type === "COVER_LETTER").length };

export function isTemplateId(value: unknown): value is string { return typeof value === "string" && catalogById.has(value); }
