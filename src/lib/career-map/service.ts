import { z } from "zod";
import prisma from "../../../prisma/prisma";
import { getCareerProfile } from "@/lib/career-profile/service";
import { ProfileError } from "@/lib/career-profile/http";
import { runCareerMapAgent } from "@/lib/agentic/agents/career-map/agent/career-map.agent";
import { careerRoleById } from "@/lib/agentic/agents/career-map/tools/catalog.tool";
import { preferenceSchema } from "@/lib/agentic/agents/career-map/tools/preferences.tool";
import { extractCareerEvidence } from "@/lib/agentic/agents/career-map/tools/evidence.tool";
import { rankCareerRoles } from "@/lib/agentic/agents/career-map/tools/rank.tool";
import { makeCareerMapGraph } from "@/lib/agentic/agents/career-map/tools/roadmap.tool";
import { verifyCareerMapGraph } from "@/lib/agentic/agents/career-map/tools/verify.tool";

/** Existing callers keep their route contracts; the graph runs without persistence. */
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

export const mapInputSchema = z.object({
  cvId: z.string().uuid().nullable().optional(),
  preferences: preferenceSchema.default({}),
}).strict();

/** Omission means keep existing completed steps, not reset them. */
export const goalInputSchema = z.object({
  roleId: z.string().min(1).max(80),
  mapId: z.string().uuid().nullable().optional(),
  completedStepIds: z.array(z.string().max(80)).max(20).optional(),
}).strict();

export async function createMap(
  userId: string,
  input: z.infer<typeof mapInputSchema>,
  signal?: AbortSignal,
) {
  const profile = await getCareerProfile(userId);
  let cv: {
    id: string; title: string; skills: unknown; experiences: unknown;
    educations: unknown; certifications: unknown; projects: unknown;
    languages: unknown;
  } | null = null;

  // A CV ID in the request must belong to the authenticated user.
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

  // Career Direction is the canonical fallback; target roles NEVER count as skill evidence.
  const preferences = preferenceSchema.parse(input.preferences);
  if (!preferences.targetRoles.length && profile.targetJobTitle?.trim()) {
    preferences.targetRoles = [profile.targetJobTitle.trim().slice(0, 100)];
  }
  if (!preferences.interests.length && profile.targetIndustry?.trim()) {
    preferences.interests = [profile.targetIndustry.trim().slice(0, 80)];
  }
  let generated: Awaited<ReturnType<typeof runCareerMapAgent>>;
  try {
    generated = await runCareerMapAgent({
      actorId: userId, input: { profile, cv, preferences }, signal,
    });
  } catch (error) {
    // This agent's six nodes are deterministic, without AI calls or writes.
    // If LangGraph execution fails unexpectedly, rerun the SAME verified
    // catalog calculation. Never fall back on a cancelled or timed-out request.
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code !== "AGENT_RUN_FAILED" || signal?.aborted) throw error;
    const graph = makeCareerMapGraph(rankCareerRoles(
      extractCareerEvidence(profile, cv), preferences,
    ));
    if (!verifyCareerMapGraph(graph)) throw new ProfileError(502, "CAREER_MAP_INVALID_GRAPH");
    console.warn("Career Map: verified deterministic fallback after graph execution failure", {
      code: "AGENT_RUN_FAILED",
    });
    generated = {
      graph,
      snapshot: {
        name: profile.name ?? "", headline: profile.headline ?? "",
        experienceLevel: profile.experienceLevel ?? "",
        sourceCvTitle: cv?.title ?? null,
        skillSource: cv ? "profile-and-selected-resume" : "profile",
      },
    };
  }
  // Saving happens only here, after a verified graph or verified deterministic fallback.
  return prisma.careerMap.create({
    data: {
      userId, cvId: cv?.id ?? null,
      title: `Career map — ${profile.headline || cv?.title || "My profile"}`,
      preferences, profile: generated.snapshot, graph: generated.graph,
    },
  });
}

export async function createGoal(userId: string, input: z.infer<typeof goalInputSchema>) {
  const role = careerRoleById(input.roleId);
  if (!role) throw new ProfileError(400, "UNKNOWN_ROLE");
  let plan: { id: string; title: string; order: number }[];
  if (input.mapId) {
    const map = await prisma.careerMap.findFirst({
      where: { id: input.mapId, userId }, select: { graph: true },
    });
    if (!map) throw new ProfileError(404, "MAP_NOT_FOUND");
    const graph = map.graph as { nodes?: unknown } | null;
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
    const selected = nodes.find((node: unknown) => {
      return Boolean(node && typeof node === "object" && "id" in node && node.id === role.id);
    }) as { plan?: unknown } | undefined;
    if (!selected) throw new ProfileError(400, "ROLE_NOT_IN_MAP");
    // Trust only the known, versioned catalog; old snapshots may include invalid data.
    const valid = new Set<string>(role.skills as readonly string[]);
    plan = Array.isArray(selected.plan)
      ? selected.plan.filter((step: unknown): step is { id: string; title: string; order: number } => {
          if (!step || typeof step !== "object") return false;
          const item = step as Record<string, unknown>;
          return typeof item.id === "string" && typeof item.title === "string" &&
            typeof item.order === "number" && Number.isSafeInteger(item.order) &&
            valid.has(item.id.slice(`${role.id}-`.length)) &&
            item.id.startsWith(`${role.id}-`) && item.title.length <= 160;
        }).slice(0, 4)
      : [];
  } else {
    // Backward-compatible stand-alone goal, without inventing a generated map.
    plan = role.skills.slice(0, 4).map((skill, index) => ({
      id: `${role.id}-${skill}`, title: `Develop or document ${skill}`, order: index + 1,
    }));
  }
  const allowedIds = new Set(plan.map(item => item.id));
  const completed = input.completedStepIds;
  if (completed && (new Set(completed).size !== completed.length ||
     completed.some(id => !allowedIds.has(id)))) {
    throw new ProfileError(400, "INVALID_GOAL_PROGRESS");
  }
  return prisma.careerGoal.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    create: {
      userId, careerMapId: input.mapId ?? null, roleId: role.id,
      title: role.title, plan, completedStepIds: completed ?? [],
    },
    update: {
      ...(input.mapId ? { careerMapId: input.mapId, plan } : {}),
      ...(completed ? { completedStepIds: completed } : {}),
    },
  });
}
