import { z } from "zod";
import { reconcileExtractedProfile } from "./merge";
import { referralSources, resumeMarkets } from "@/lib/resume-market";

export const careerGoals = ["FIRST_JOB", "BETTER_JOB", "CAREER_CHANGE", "INTERNSHIP", "REMOTE_WORK", "INTERNATIONAL_JOB", "IMPROVE_RESUME"] as const;
export const experienceLevels = ["STUDENT", "ENTRY_LEVEL", "PROFESSIONAL", "SENIOR", "MANAGER", "EXECUTIVE", "FREELANCER"] as const;
export const workModes = ["ONSITE", "HYBRID", "REMOTE", "FLEXIBLE"] as const;
const text = (max: number) => z.string().trim().max(max);
const id = z.string().uuid().optional();
export const webUrl = z.union([z.literal(""), z.string().trim().max(2048).url().refine(value => /^https?:\/\//i.test(value), "HTTP(S) URL required")]);

// Keep dates as strings so legacy values and partial years round-trip unchanged.
export const experienceSchema = z.object({ id, title: text(200).min(1), company: text(200), location: text(200), start: text(80), end: text(80), description: text(8000) }).strict();
export const educationSchema = z.object({ id, degree: text(200).min(1), school: text(200), start: text(80), end: text(80), description: text(8000) }).strict();
export const projectSchema = z.object({ id, title: text(200).min(1), start: text(80), end: text(80), url: webUrl, description: text(8000) }).strict();
export const certificationSchema = z.object({ id, name: text(200).min(1), organization: text(200), date: text(80), description: text(4000) }).strict();
export const awardSchema = z.object({ title: text(200).min(1), organization: text(200), date: text(80), description: text(4000) }).strict();
export const linkSchema = z.object({ label: text(100).min(1), url: webUrl.refine(Boolean, "URL required") }).strict();

// Explicit choices: never inferred or fabricated from a CV import.
export const jobPreferencesSchema = z.object({
  industry: text(100),
  seniority: z.enum(["", "entry", "junior", "mid", "senior", "lead"]),
  residenceCountry: z.string().regex(/^$|^[A-Z]{2}$/),
  employmentTypes: z.array(
    z.enum(["full-time", "part-time", "freelance", "internship"]),
  ).max(4),
  salaryRate: z.enum(["hourly", "monthly", "yearly"]),
  minimumSalary: z.number().int().min(0).max(100_000_000).nullable(),
}).strict();

export type JobPreferences = z.infer<typeof jobPreferencesSchema>;

export const defaultJobPreferences: JobPreferences = {
  industry: "",
  seniority: "",
  residenceCountry: "",
  employmentTypes: [],
  salaryRate: "yearly",
  minimumSalary: null,
};


/** One canonical Career Direction with legacy job-preference storage retained. */
const seniorityToExperience = {
  entry: "ENTRY_LEVEL",
  junior: "ENTRY_LEVEL",
  mid: "PROFESSIONAL",
  senior: "SENIOR",
  lead: "MANAGER",
} as const satisfies Record<Exclude<JobPreferences["seniority"], "">, typeof experienceLevels[number]>;

const experienceToSeniority: Record<
  typeof experienceLevels[number], JobPreferences["seniority"]
> = {
  STUDENT: "",
  ENTRY_LEVEL: "entry",
  PROFESSIONAL: "mid",
  SENIOR: "senior",
  MANAGER: "lead",
  EXECUTIVE: "lead",
  FREELANCER: "",
};

export function harmonizeCareerDirection<T extends ProfileData>(profile: T): T {
  const industry = profile.targetIndustry || profile.jobPreferences.industry;
  const experience = profile.experienceLevel || (
    profile.jobPreferences.seniority
      ? seniorityToExperience[profile.jobPreferences.seniority]
      : ""
  );
  return {
    ...profile,
    targetIndustry: industry,
    experienceLevel: experience,
    jobPreferences: {
      ...profile.jobPreferences,
      industry: industry.slice(0, 100),
      seniority: experience
        ? experienceToSeniority[experience]
        : "",
    },
  };
}

export const profileDataSchema = z.object({
  name: text(200), email: text(254).email(), phone: text(80), address: text(500),
  headline: text(300), summary: text(8000), skills: text(8000), languages: text(4000), hobbies: text(4000),
  linkedin: webUrl, github: webUrl, portfolio: webUrl,
  jobPreferences: jobPreferencesSchema,
  careerGoal: z.enum(careerGoals).or(z.literal("")),
  experienceLevel: z.enum(experienceLevels).or(z.literal("")),
  targetJobTitle: text(200), targetIndustry: text(200), targetCountry: text(200),
  preferredWorkMode: z.enum(workModes).or(z.literal("")),
  targetMarket: z.enum(resumeMarkets).or(z.literal("")), referralSource: z.enum(referralSources).or(z.literal("")), resumeSource: z.enum(["UPLOAD", "SCRATCH"]).or(z.literal("")),
  experiences: z.array(experienceSchema).max(50), education: z.array(educationSchema).max(50),
  projects: z.array(projectSchema).max(50), certifications: z.array(certificationSchema).max(50),
  awards: z.array(awardSchema).max(50), professionalLinks: z.array(linkSchema).max(30),
}).strict();

export type ProfileData = z.infer<typeof profileDataSchema>;
export type CareerProfile = ProfileData & { revision: number; onboardingCompletedAt: string | null };
export const saveProfileSchema = z.object({
  profile: profileDataSchema, revision: z.number().int().nonnegative(),
  completeOnboarding: z.boolean(), confirmed: z.literal(true),
}).strict().superRefine(({ profile, completeOnboarding }, ctx) => {
  if (!completeOnboarding) return;
  for (const key of ["name", "careerGoal", "experienceLevel", "targetJobTitle", "targetIndustry", "targetCountry", "preferredWorkMode", "targetMarket", "resumeSource"] as const) {
    if (!profile[key]) ctx.addIssue({ code: "custom", path: ["profile", key], message: "Required to complete onboarding" });
  }
});

export function emptyProfile(email = ""): ProfileData {
  return { name: "", email, phone: "", address: "", headline: "", summary: "", skills: "", languages: "", hobbies: "", linkedin: "", github: "", portfolio: "", jobPreferences: { ...defaultJobPreferences }, careerGoal: "", experienceLevel: "", targetJobTitle: "", targetIndustry: "", targetCountry: "", preferredWorkMode: "", targetMarket: "", referralSource: "", resumeSource: "", experiences: [], education: [], projects: [], certifications: [], awards: [], professionalLinks: [] };
}

// Optional achievements do not penalise people at the start of their careers.
export function profileCompleteness(profile: Partial<Omit<ProfileData, "experiences" | "education" | "projects">> & { experiences?: { title: string }[]; education?: { degree: string }[]; projects?: { title: string }[] }) {
  const sections = {
    personal: Boolean(profile.name?.trim() && profile.email?.trim()),
    target: Boolean(profile.careerGoal && profile.experienceLevel && profile.targetJobTitle?.trim() && profile.targetIndustry?.trim() && profile.targetCountry?.trim() && profile.preferredWorkMode && profile.targetMarket),
    headline: Boolean(profile.headline?.trim()), summary: Boolean(profile.summary?.trim()),
    background: Boolean(profile.experiences?.some(x => x.title.trim()) || profile.education?.some(x => x.degree.trim()) || profile.projects?.some(x => x.title.trim())),
    skills: Boolean(profile.skills?.trim()), languages: Boolean(profile.languages?.trim()),
  };
  const completed = Object.values(sections).filter(Boolean).length;
  return { sections, completed, total: Object.keys(sections).length, percentage: Math.round(completed / Object.keys(sections).length * 100) };
}

// This client-side helper and the agent use the same safe, deterministic merge.
// Import only proposes changes; saving still requires explicit user confirmation.
export function mergeExtractedProfile(current: ProfileData, extracted: Partial<ProfileData>): ProfileData {
  return reconcileExtractedProfile(current, extracted).proposal;
}

export const generationInputSchema = z.object({
  description: z.string().trim().min(1).max(30000),
  conversationId: z.string().uuid(),
  language: z.enum(["fr", "en", "French", "English"]).transform(value => value === "fr" || value === "French" ? "fr" as const : "en" as const),
  // Older clients sent a profile snapshot. It is ignored: the server loads facts.
  user: z.unknown().optional(),
}).strict().transform(({ user: _ignored, ...request }) => request);
