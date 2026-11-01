import { boundedRecords, boundedStrings, boundedText } from "../../core/context/limits.ts";

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
const string = (value: unknown, max = 200) => boundedText(value, max);
const strings = (value: unknown, n = 15, max = 400) => boundedStrings(value, n, max);
const pickRows = (items: unknown, fields: readonly string[], count: number, length = 500) =>
  boundedRecords(items, count).map((entry) => Object.fromEntries(fields.map((field) =>
    [field, Array.isArray(entry[field]) ? strings(entry[field], 10, length) : string(entry[field], length)])));

/** The professional profile is factual context, not permission to expose personal contact data. */
export function projectProfile(source: unknown, agentId: string) {
  const p = record(source);
  const preferences = record(p.jobPreferences);
  return {
    headline: string(p.headline, 250), summary: string(p.summary, 2600),
    skills: string(p.skills, 2200), languages: string(p.languages, 600),
    careerGoal: string(p.careerGoal, 70), experienceLevel: string(p.experienceLevel, 70),
    targetJobTitle: string(p.targetJobTitle, 160), targetIndustry: string(p.targetIndustry, 100),
    targetCountry: string(p.targetCountry, 100), preferredWorkMode: string(p.preferredWorkMode, 70),
    ...(["profile", "job-discovery", "application", "supervisor"].includes(agentId) ? {
      preferences: {
        industry: string(preferences.industry, 100), seniority: string(preferences.seniority, 40),
        residenceCountry: string(preferences.residenceCountry, 2),
        employmentTypes: strings(preferences.employmentTypes, 4, 30),
        salaryRate: string(preferences.salaryRate, 20),
        minimumSalary: typeof preferences.minimumSalary === "number" &&
          Number.isSafeInteger(preferences.minimumSalary) && preferences.minimumSalary >= 0
          ? preferences.minimumSalary : null,
      },
    } : {}),
    experiences: pickRows(p.experiences, ["title", "company", "location", "start", "end", "description"], 14, 450),
    education: pickRows(p.education, ["degree", "school", "start", "end", "description"], 8, 300),
    projects: pickRows(p.projects, ["title", "start", "end", "description"], 8, 350),
    certifications: pickRows(p.certifications, ["name", "organization", "date", "description"], 8, 200),
  };
}

const resumeSections = ["summary", "experiences", "educations", "skills", "projects", "certifications", "languages"] as const;
const fields = {
  summary: [] as string[],
  experiences: ["title", "company", "location", "start", "end", "description"],
  educations: ["degree", "school", "location", "start", "end", "description"],
  skills: ["hardskills", "softskills", "tools"],
  projects: ["title", "description", "technologies"],
  certifications: ["title", "issuer", "date", "description"],
  languages: ["language", "level"],
} satisfies Record<typeof resumeSections[number], readonly string[]>;

/** ATS and Job Match see only sections that will actually appear on the document. */
export function projectResume(source: unknown, visibleOnly: boolean) {
  const r = record(source);
  const design = record(r.design);
  const hidden = strings(design.hiddenSections, 7, 30).filter((key) => resumeSections.includes(key as typeof resumeSections[number]));
  const sectionOrder = strings(design.sectionOrder, 7, 30).filter((key) => resumeSections.includes(key as typeof resumeSections[number]));
  const included = resumeSections.filter((key) => !visibleOnly || !hidden.includes(key));
  const sections: Record<string, unknown> = {};
  for (const key of included) {
    sections[key] = key === "summary"
      ? strings(r.summary, 3, 1500)
      : pickRows(r[key], fields[key], key === "experiences" ? 20 : 12, 550);
  }
  const contact = record(r.contact);
  return {
    title: string(r.title, 160),
    format: { layout: string(design.layout, 30), paper: string(design.paper, 20),
      documentLanguage: string(design.documentLanguage, 12),
      targetMarket: string(design.targetMarket, 16), sectionOrder, hiddenSections: hidden },
    contactPresence: { name: Boolean(string(contact.name)), email: Boolean(string(contact.email)),
      phone: Boolean(string(contact.phone)), city: Boolean(string(contact.city)) },
    sections,
  };
}

export function projectJob(source: unknown) {
  const j = record(source);
  return {
    title: string(j.title, 200), company: string(j.company, 200),
    location: string(j.location, 200), seniority: string(j.seniority, 100),
    description: string(j.description, 9000),
    requiredSkills: strings(j.requiredSkills, 30, 120),
    preferredSkills: strings(j.preferredSkills, 20, 120),
  };
}

export function projectApplication(source: unknown) {
  const a = record(source);
  return {
    company: string(a.company, 200), jobTitle: string(a.jobTitle, 200),
    status: string(a.status, 60), nextAction: string(a.nextAction, 350),
    deadline: a.deadline instanceof Date && Number.isFinite(a.deadline.valueOf())
      ? a.deadline.toISOString().slice(0, 10) : null,
  };
}

export function projectCoverLetter(source: unknown) {
  const c = record(source);
  return {
    recipientName: string(c.recipientName, 120), recipientTitle: string(c.recipientTitle, 120),
    companyName: string(c.companyName, 160), positionTitle: string(c.positionTitle, 160),
    introduction: string(c.introduction, 1700), body: string(c.body, 3500),
    conclusion: string(c.conclusion, 1200),
  };
}
