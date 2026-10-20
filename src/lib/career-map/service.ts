import { z } from "zod";
import prisma from "../../../prisma/prisma";
import { getCareerProfile } from "@/lib/career-profile/service";
import { ProfileError } from "@/lib/career-profile/http";

export function careerMapStore() {
  const store = prisma as typeof prisma & { careerMap?: typeof prisma.careerMap; careerGoal?: typeof prisma.careerGoal };
  if (!store.careerMap || !store.careerGoal) throw new ProfileError(503, "CAREER_MAP_SETUP_REQUIRED");
  return { maps: store.careerMap, goals: store.careerGoal };
}

const roleCatalog = [
  { id: "software-engineer", title: "Software Engineer", skills: ["javascript", "typescript", "react", "node", "git", "sql"], next: ["senior-software-engineer", "technical-product-manager"] },
  { id: "senior-software-engineer", title: "Senior Software Engineer", skills: ["typescript", "react", "architecture", "testing", "mentoring", "git"], next: ["engineering-manager", "solutions-architect"] },
  { id: "technical-product-manager", title: "Technical Product Manager", skills: ["product", "roadmap", "analytics", "communication", "agile", "technical"], next: ["product-manager", "engineering-manager"] },
  { id: "product-manager", title: "Product Manager", skills: ["product", "roadmap", "analytics", "research", "communication", "agile"], next: ["senior-product-manager"] },
  { id: "data-analyst", title: "Data Analyst", skills: ["sql", "excel", "analytics", "python", "visualization", "statistics"], next: ["data-scientist", "business-analyst"] },
  { id: "data-scientist", title: "Data Scientist", skills: ["python", "sql", "statistics", "machine learning", "visualization", "analytics"], next: ["machine-learning-engineer"] },
  { id: "ux-designer", title: "UX Designer", skills: ["figma", "research", "prototyping", "design", "communication", "accessibility"], next: ["product-designer", "design-manager"] },
  { id: "business-analyst", title: "Business Analyst", skills: ["analytics", "sql", "requirements", "communication", "process", "excel"], next: ["product-manager", "data-analyst"] },
] as const;

export const mapInputSchema = z.object({ cvId: z.string().uuid().nullable().optional(), preferences: z.object({ targetRoles: z.array(z.string().trim().max(100)).max(5).default([]), interests: z.array(z.string().trim().max(80)).max(8).default([]), workMode: z.enum(["REMOTE", "HYBRID", "ONSITE", "ANY"]).default("ANY") }).default({}) }).strict();
export const goalInputSchema = z.object({ roleId: z.string().min(1).max(80), mapId: z.string().uuid().nullable().optional(), completedStepIds: z.array(z.string().max(80)).max(20).default([]) }).strict();

const tokens = (value: unknown) => String(value ?? "").toLowerCase().split(/[^\p{L}\p{N}+#.]+/u).map(x => x.trim()).filter(x => x.length > 1);
function roleGraph(skills: string[], targets: string[]) {
  const normalized = new Set(skills);
  const ordered = [...roleCatalog].sort((a, b) => Number(targets.some(t => t.toLowerCase() === a.title.toLowerCase())) - Number(targets.some(t => t.toLowerCase() === b.title.toLowerCase())) || b.skills.filter(s => normalized.has(s)).length - a.skills.filter(s => normalized.has(s)).length).slice(0, 5);
  const nodes = ordered.map((role, index) => {
    const acquired = role.skills.filter(s => normalized.has(s)); const missing = role.skills.filter(s => !normalized.has(s));
    return { ...role, x: 260 + (index % 2) * 310, y: 95 + Math.floor(index / 2) * 170, compatibility: Math.max(15, Math.min(95, Math.round((acquired.length / role.skills.length) * 80 + 15))), acquired, missing, explanation: acquired.length ? `Votre profil mentionne ${acquired.join(", ")}.` : "Cette piste est exploratoire : validez les prérequis avant de vous engager.", plan: missing.slice(0, 3).map((skill, i) => ({ id: `${role.id}-${skill}`, title: `Développer ${skill}`, order: i + 1 })) };
  });
  return { nodes, edges: nodes.flatMap(node => node.next.filter(id => nodes.some(n => n.id === id)).map(to => ({ from: node.id, to }))) };
}
export async function createMap(userId: string, input: z.infer<typeof mapInputSchema>) {
  const profile = await getCareerProfile(userId);
  let cv: { id: string; title: string; skills: unknown; experiences: unknown; educations: unknown; certifications: unknown; projects: unknown; languages: unknown } | null = null;
  if (input.cvId) { cv = await prisma.cv.findFirst({ where: { id: input.cvId, conversation: { userId } }, select: { id: true, title: true, skills: true, experiences: true, educations: true, certifications: true, projects: true, languages: true } }); if (!cv) throw new ProfileError(404, "CV_NOT_FOUND"); }
  const source = [profile.skills, profile.languages, profile.headline, profile.summary, ...profile.experiences.flatMap(x => [x.title, x.description]), ...profile.projects.flatMap(x => [x.title, x.description]), cv && JSON.stringify(cv)].flatMap(tokens);
  const graph = roleGraph([...new Set(source)], input.preferences.targetRoles);
  const snapshot = { headline: profile.headline, experienceLevel: profile.experienceLevel, skills: [...new Set(source)].slice(0, 80), sourceCvTitle: cv?.title ?? null };
  return prisma.careerMap.create({ data: { userId, cvId: cv?.id, title: `Career map — ${profile.headline || cv?.title || "Mon profil"}`, preferences: input.preferences, profile: snapshot, graph } });
}
export async function createGoal(userId: string, input: z.infer<typeof goalInputSchema>) {
  const role = roleCatalog.find(x => x.id === input.roleId); if (!role) throw new ProfileError(400, "UNKNOWN_ROLE");
  if (input.mapId && !await prisma.careerMap.findFirst({ where: { id: input.mapId, userId }, select: { id: true } })) throw new ProfileError(404, "MAP_NOT_FOUND");
  const plan = role.skills.slice(0, 4).map((skill, index) => ({ id: `${role.id}-${skill}`, title: `Consolider ${skill}`, order: index + 1 }));
  return prisma.careerGoal.upsert({ where: { userId_roleId: { userId, roleId: role.id } }, create: { userId, careerMapId: input.mapId ?? null, roleId: role.id, title: role.title, plan, completedStepIds: input.completedStepIds }, update: { careerMapId: input.mapId ?? undefined, completedStepIds: input.completedStepIds } });
}
