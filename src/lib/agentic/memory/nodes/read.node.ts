import prisma from "../../../../../prisma/prisma";
import { CareerContractError } from "@/lib/career-os/contracts";
import { MEMORY_AGENTS, type MemoryAgent } from "../tools/policy.tool";
import { assembleAgentMemory, type AgentMemorySnapshot } from "../tools/assemble.tool";

/** Server-only retrieval. No actorId, scope, or mission ID may come from model/tool arguments. */
export async function loadCareerMemoryForAgent(actorId: string, agentId: MemoryAgent, missionId?: string): Promise<AgentMemorySnapshot> {
  if (!actorId) throw new CareerContractError(401, "UNAUTHORIZED");
  if (!MEMORY_AGENTS.includes(agentId)) throw new CareerContractError(403, "MEMORY_SCOPE_FORBIDDEN");
  const preferences = await prisma.careerAgentMemory.findMany({
    where: { userId: actorId, allowedAgents: { has: agentId } },
    select: { key: true, value: true, allowedAgents: true },
    orderBy: { key: "asc" }, take: 7,
  });
  if (!missionId) return assembleAgentMemory(preferences, agentId);
  // Only explicit mission context, never "most recent mission" from another chat.
  const mission = await prisma.careerMission.findFirst({
    where: { id: missionId, userId: actorId },
    select: { id: true, title: true, revision: true, status: true,
      _count: { select: { runs: { where: { status: "COMPLETED" } },
        approvals: { where: { status: "PENDING", expiresAt: { gt: new Date() } } } } } },
  });
  if (!mission) throw new CareerContractError(404, "MISSION_NOT_FOUND");
  return assembleAgentMemory(preferences, agentId, {
    id: mission.id, title: mission.title.slice(0, 120), revision: mission.revision,
    status: mission.status, completedRuns: mission._count.runs, pendingApprovals: mission._count.approvals,
  });
}
