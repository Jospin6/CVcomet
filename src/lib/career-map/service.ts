import { z } from "zod";
import prisma from "../../../prisma/prisma";
import { getCareerProfile } from "@/lib/career-profile/service";
import { ProfileError } from "@/lib/career-profile/http";

export function careerMapStore() {
  const store = prisma as typeof prisma & {
    careerMap?: typeof prisma.careerMap;
    careerGoal?: typeof prisma.careerGoal;
  };
  if (!store.careerMap || !store.careerGoal) {
    throw new ProfileError(503, "CAREER_MAP_SETUP_REQUIRED");
  }
  return { maps: store.careerMap, goals: store.careerGoal };
}

// A curated taxonomy, not fabricated job vacancies or salary estimates.
// The map scores the skills explicitly present in the owner's profile/CV.
const roleCatalog = [
  { id: "software-engineer", title: "Software Engineer", skills: ["typescript", "javascript", "react", "node", "git", "sql"] },
  { id: "senior-software-engineer", title: "Senior Software Engineer", skills: ["typescript", "architecture", "testing", "mentoring", "git", "sql"] },
  { id: "backend-engineer", title: "Backend Engineer", skills: ["node", "python", "sql", "api", "postgresql", "testing"] },
  { id: "solutions-architect", title: "Solutions Architect", skills: ["architecture", "cloud", "api", "security", "communication", "design"] },
  { id: "engineering-manager", title: "Engineering Manager", skills: ["leadership", "mentoring", "architecture", "planning", "communication", "agile"] },
  { id: "technical-product-manager", title: "Technical Product Manager", skills: ["product", "roadmap", "analytics", "communication", "agile", "technical"] },
  { id: "product-manager", title: "Product Manager", skills: ["product", "roadmap", "analytics", "research", "communication", "agile"] },
  { id: "ai-engineer", title: "AI Engineer", skills: ["python", "llm", "rag", "api", "machine learning", "cloud"] },
  { id: "machine-learning-engineer", title: "Machine Learning Engineer", skills: ["python", "machine learning", "pytorch", "deployment", "cloud", "statistics"] },
  { id: "ai-solutions-architect", title: "AI Solutions Architect", skills: ["ai", "architecture", "llm", "cloud", "security", "api"] },
  { id: "ai-product-manager", title: "AI Product Manager", skills: ["product", "ai", "roadmap", "analytics", "research", "communication"] },
  { id: "data-analyst", title: "Data Analyst", skills: ["sql", "excel", "analytics", "python", "visualization", "statistics"] },
  { id: "data-scientist", title: "Data Scientist", skills: ["python", "sql", "statistics", "machine learning", "visualization", "analytics"] },
  { id: "business-analyst", title: "Business Analyst", skills: ["analytics", "sql", "requirements", "communication", "process", "excel"] },
  { id: "devops-engineer", title: "DevOps Engineer", skills: ["docker", "kubernetes", "cloud", "ci/cd", "monitoring", "linux"] },
  { id: "security-engineer", title: "Security Engineer", skills: ["security", "cloud", "network", "monitoring", "testing", "linux"] },
  { id: "ux-designer", title: "UX Designer", skills: ["figma", "research", "prototyping", "design", "communication", "accessibility"] },
  { id: "product-designer", title: "Product Designer", skills: ["figma", "design", "research", "prototyping", "product", "accessibility"] },
  { id: "technical-founder", title: "Technical Founder", skills: ["product", "leadership", "business", "development", "finance", "communication"] },
  { id: "technology-director", title: "Technology Director", skills: ["architecture", "leadership", "security", "planning", "cloud", "management"] },
] as const;

const preferenceSchema = z.object({
  targetRoles: z.array(z.string().trim().max(100)).max(5).default([]),
  interests: z.array(z.string().trim().max(80)).max(8).default([]),
  workMode: z.enum(["REMOTE", "HYBRID", "ONSITE", "ANY"]).default("ANY"),
  goal: z.enum(["EXPLORATION", "ADVANCEMENT", "CHANGE"]).default("EXPLORATION"),
  balance: z.enum(["CHILL", "BALANCED", "HUSTLE"]).default("BALANCED"),
  identity: z.enum(["SPECIALIST", "GENERALIST", "FOUNDER"]).default("SPECIALIST"),
  income: z.enum(["HIGH", "COMFORTABLE", "UNIMPORTANT"]).default("COMFORTABLE"),
  qualities: z.array(z.enum(["LEADERSHIP", "KNOWLEDGE", "CREATIVITY", "PEOPLE", "IMPACT"])).max(5).default([]),
  positions: z.number().int().min(4).max(12).default(9),
});

export const mapInputSchema = z.object({
  cvId: z.string().uuid().nullable().optional(),
  preferences: preferenceSchema.default({}),
}).strict();

export const goalInputSchema = z.object({
  roleId: z.string().min(1).max(80),
  mapId: z.string().uuid().nullable().optional(),
  completedStepIds: z.array(z.string().max(80)).max(20).default([]),
}).strict();

type MapPreferences = z.infer<typeof preferenceSchema>;

const normalize = (s: unknown) => String(s ?? "")
  .normalize("NFKC")
  .toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}+.#/]+/gu, " ")
  .trim();

// Test whole phrases/words to avoid a misleading match from partial words.
function hasSkill(text: string, skill: string) {
  const source = ` ${normalize(text)} `;
  const phrase = ` ${normalize(skill)} `;
  return source.includes(phrase);
}

function roleGraph(sourceText: string, prefs: MapPreferences) {
  const targets = prefs.targetRoles.map(normalize).filter(Boolean);
  const interests = prefs.interests.map(normalize).filter(Boolean);

  const ranked = roleCatalog.map((role) => {
    const acquired = role.skills.filter(skill => hasSkill(sourceText, skill));
    const missing = role.skills.filter(skill => !hasSkill(sourceText, skill));
    const exactTarget = targets.includes(normalize(role.title));
    const associatedInterest = interests.some(term => normalize(role.title).includes(term));
    const identityBonus = prefs.identity === "FOUNDER" && role.id === "technical-founder"
      ? 2 : prefs.identity === "GENERALIST" && (role.id.includes("product") || role.id.includes("architect"))
      ? 1 : 0;
    const advanceBonus = prefs.goal === "ADVANCEMENT" && /senior|manager|director|architect/i.test(role.title)
      ? 1 : 0;
    return {
      role, acquired, missing,
      priority: (exactTarget ? 20 : 0) + (associatedInterest ? 4 : 0) +
        acquired.length * 2 + identityBonus + advanceBonus,
    };
  });

  ranked.sort((a, b) => b.priority - a.priority || a.role.title.localeCompare(b.role.title));
  const candidates = ranked.slice(0, prefs.positions);

  const nodes = candidates.map(({ role, acquired, missing }) => ({
    id: role.id,
    title: role.title,
    // Not a hiring prediction. Only observed overlap with this role's catalog skills.
    compatibility: Math.round(acquired.length * 100 / role.skills.length),
    acquired,
    missing,
    explanation: acquired.length
      ? `Your profile or selected resume mentions: ${acquired.join(", ")}.`
      : "An exploratory path. No matching catalog skills were identified in your documents.",
    plan: missing.slice(0, 3).map((skill, index) => ({
      id: `${role.id}-${skill}`,
      title: `Develop or document ${skill}`,
      order: index + 1,
    })),
  }));

  // The client draws a visible line from the user to every suggested position.
  const edges = nodes.map(node => ({ from: "profile", to: node.id }));
  return { nodes, edges, methodology: "catalog-skill-overlap" as const };
}

export async function createMap(
  userId: string,
  input: z.infer<typeof mapInputSchema>,
) {
  const profile = await getCareerProfile(userId);
  let cv: {
    id: string; title: string; skills: unknown; experiences: unknown;
    educations: unknown; certifications: unknown; projects: unknown;
    languages: unknown;
  } | null = null;

  if (input.cvId) {
    cv = await prisma.cv.findFirst({
      where: { id: input.cvId, conversation: { userId } },
      select: {
        id: true, title: true, skills: true, experiences: true,
        educations: true, certifications: true, projects: true, languages: true,
      },
    });
    if (!cv) throw new ProfileError(404, "CV_NOT_FOUND");
  }

  const text = [
    profile.skills, profile.headline, profile.summary,
    ...profile.experiences.flatMap(e => [e.title, e.description]),
    ...profile.projects.flatMap(p => [p.title, p.description]),
    ...profile.education.flatMap(e => [e.degree, e.description]),
    ...(cv ? [
      JSON.stringify(cv.skills), JSON.stringify(cv.experiences),
      JSON.stringify(cv.projects), JSON.stringify(cv.educations),
      JSON.stringify(cv.certifications),
    ] : []),
  ].filter(Boolean).join(" ");

  const prefs = preferenceSchema.parse(input.preferences);
  // Reuse career direction without asking the candidate to re-enter it.
  if (!prefs.targetRoles.length && profile.targetJobTitle?.trim()) {
    prefs.targetRoles = [profile.targetJobTitle.trim().slice(0, 100)];
  }
  if (!prefs.interests.length && profile.targetIndustry?.trim()) {
    prefs.interests = [profile.targetIndustry.trim().slice(0, 80)];
  }
  const graph = roleGraph(text, prefs);
  const snapshot = {
    name: profile.name,
    headline: profile.headline,
    experienceLevel: profile.experienceLevel,
    sourceCvTitle: cv?.title ?? null,
    skillSource: cv?.id ? "profile-and-selected-resume" : "profile",
  };

  return prisma.careerMap.create({
    data: {
      userId,
      cvId: cv?.id ?? null,
      title: `Career map — ${profile.headline || cv?.title || "My profile"}`,
      preferences: prefs,
      profile: snapshot,
      graph,
    },
  });
}

export async function createGoal(userId: string, input: z.infer<typeof goalInputSchema>) {
  const role = roleCatalog.find(item => item.id === input.roleId);
  if (!role) throw new ProfileError(400, "UNKNOWN_ROLE");
  if (input.mapId && !await prisma.careerMap.findFirst({
    where: { id: input.mapId, userId }, select: { id: true },
  })) throw new ProfileError(404, "MAP_NOT_FOUND");

  const plan = role.skills.slice(0, 4).map((skill, index) => ({
    id: `${role.id}-${skill}`,
    title: `Develop or document ${skill}`,
    order: index + 1,
  }));
  return prisma.careerGoal.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    create: {
      userId, careerMapId: input.mapId ?? null, roleId: role.id,
      title: role.title, plan, completedStepIds: input.completedStepIds,
    },
    update: {
      careerMapId: input.mapId ?? undefined,
      completedStepIds: input.completedStepIds,
    },
  });
}
