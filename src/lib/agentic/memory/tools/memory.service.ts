import prisma from "../../../../../prisma/prisma";
import { CareerContractError } from "@/lib/career-os/contracts";
import { assertMemoryPreference, type MemoryPreferenceInput } from "./policy.tool";

function ensureActor(actorId: string) {
  if (!actorId) throw new CareerContractError(401, "UNAUTHORIZED");
}
function validate(input: MemoryPreferenceInput) {
  try { return assertMemoryPreference(input); }
  catch { throw new CareerContractError(400, "MEMORY_INVALID"); }
}
const publicFields = { id: true, key: true, value: true, allowedAgents: true, revision: true, createdAt: true, updatedAt: true } as const;

/** Every query is owner filtered. Never store conversation text, transcripts or CV bodies. */
export async function listMemoryPreferences(actorId: string) {
  ensureActor(actorId);
  const items = await prisma.careerAgentMemory.findMany({
    where: { userId: actorId }, orderBy: { key: "asc" }, select: publicFields, take: 7,
  });
  return { items };
}

export async function createMemoryPreference(actorId: string, input: MemoryPreferenceInput) {
  ensureActor(actorId);
  const value = validate(input);
  try {
    return await prisma.careerAgentMemory.create({ data: { userId: actorId, ...value }, select: publicFields });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002")
      throw new CareerContractError(409, "MEMORY_ALREADY_EXISTS");
    throw error;
  }
}

export async function updateMemoryPreference(actorId: string, id: string, expectedRevision: number, input: MemoryPreferenceInput) {
  ensureActor(actorId);
  const value = validate(input);
  // CAS prevents lost updates from two open tabs. Key cannot be reassigned via PATCH.
  const result = await prisma.careerAgentMemory.updateMany({
    where: { id, userId: actorId, key: value.key, revision: expectedRevision },
    data: { value: value.value, allowedAgents: [...value.allowedAgents], revision: { increment: 1 } },
  });
  if (result.count !== 1) throw new CareerContractError(409, "MEMORY_NOT_FOUND_OR_STALE");
  const current = await prisma.careerAgentMemory.findFirst({ where: { id, userId: actorId }, select: publicFields });
  if (!current) throw new CareerContractError(404, "MEMORY_NOT_FOUND");
  return current;
}

export async function deleteMemoryPreference(actorId: string, id: string, expectedRevision: number) {
  ensureActor(actorId);
  const result = await prisma.careerAgentMemory.deleteMany({ where: { id, userId: actorId, revision: expectedRevision } });
  if (result.count !== 1) throw new CareerContractError(409, "MEMORY_NOT_FOUND_OR_STALE");
  return { deleted: true };
}
