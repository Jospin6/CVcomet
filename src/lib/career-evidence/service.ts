import prisma from "../../../prisma/prisma";
import { CareerContractError } from "@/lib/career-os/contracts";
import { getCareerProfile } from "@/lib/career-profile/service";
import { extractProfileEvidence } from "./import";
import { nextEvidenceStatus, statusAfterEdit, type EvidenceAction, type EvidenceKind, type EvidenceStatus } from "./contracts";

const select = {
  id: true, kind: true, statement: true, source: true, sourceLabel: true,
  status: true, revision: true, confirmedAt: true, revokedAt: true,
  createdAt: true, updatedAt: true,
} as const;
const conflict = () => new CareerContractError(409, "EVIDENCE_CONFLICT");
const notFound = () => new CareerContractError(404, "EVIDENCE_NOT_FOUND");

export async function listEvidence(userId: string, query: {
  status?: EvidenceStatus; kind?: EvidenceKind; cursor?: string; limit: number;
}) {
  const rows = await prisma.careerEvidence.findMany({
    where: { userId, ...(query.status ? { status: query.status } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.cursor ? { id: { lt: query.cursor } } : {}) },
    select, orderBy: { id: "desc" }, take: query.limit + 1,
  });
  const hasMore = rows.length > query.limit;
  const items = hasMore ? rows.slice(0, query.limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}

/** Agent-safe: drafts, rejects and revoked statements never enter generation context. */
export async function listConfirmedEvidenceForAgent(userId: string, limit: number) {
  return prisma.careerEvidence.findMany({
    where: { userId, status: "CONFIRMED" },
    orderBy: { updatedAt: "desc" }, take: Math.min(limit, 30),
    select: { id: true, kind: true, statement: true, source: true,
      sourceLabel: true, confirmedAt: true },
  });
}

export async function createEvidence(userId: string, input: {
  kind: EvidenceKind; statement: string; sourceLabel?: string | null;
}) {
  return prisma.careerEvidence.create({
    data: { userId, kind: input.kind, statement: input.statement,
      sourceLabel: input.sourceLabel || null, source: "MANUAL", status: "DRAFT" },
    select,
  });
}

/** User-initiated import. Import does NOT confirm anything nor change existing facts. */
export async function importProfileEvidence(userId: string) {
  const proposed = extractProfileEvidence(await getCareerProfile(userId));
  if (!proposed.length) return { proposed: 0, created: 0 };
  const result = await prisma.careerEvidence.createMany({
    data: proposed.map(item => ({ ...item, userId, source: "PROFILE_IMPORT" as const,
      status: "DRAFT" as const })),
    skipDuplicates: true,
  });
  return { proposed: proposed.length, created: result.count };
}

async function ownedCurrent(userId: string, id: string) {
  const current = await prisma.careerEvidence.findFirst({
    where: { id, userId }, select: { revision: true, status: true },
  });
  if (!current) throw notFound();
  return current;
}

export async function editEvidence(userId: string, id: string, input: {
  revision: number; kind: EvidenceKind; statement: string; sourceLabel?: string | null;
}) {
  const current = await ownedCurrent(userId, id);
  if (current.revision !== input.revision) throw conflict();
  const next = statusAfterEdit(current.status);
  if (!next) throw new CareerContractError(409, "REVOKED_EVIDENCE_IMMUTABLE");
  const result = await prisma.careerEvidence.updateMany({
    where: { id, userId, revision: input.revision, status: current.status },
    data: { kind: input.kind, statement: input.statement, sourceLabel: input.sourceLabel || null,
      status: next, source: "MANUAL", sourceKey: null, revision: { increment: 1 }, confirmedAt: null, revokedAt: null },
  });
  if (result.count !== 1) throw conflict();
  return prisma.careerEvidence.findFirst({ where: { id, userId }, select });
}

export async function transitionEvidence(userId: string, id: string, input: {
  revision: number; action: EvidenceAction;
}) {
  const current = await ownedCurrent(userId, id);
  if (current.revision !== input.revision) throw conflict();
  const next = nextEvidenceStatus(current.status, input.action);
  if (!next) throw new CareerContractError(409, "EVIDENCE_TRANSITION_NOT_ALLOWED");
  const now = new Date();
  const result = await prisma.careerEvidence.updateMany({
    where: { id, userId, revision: input.revision, status: current.status },
    data: { status: next, revision: { increment: 1 },
      confirmedAt: next === "CONFIRMED" ? now : null,
      revokedAt: next === "REVOKED" ? now : null },
  });
  if (result.count !== 1) throw conflict();
  return prisma.careerEvidence.findFirst({ where: { id, userId }, select });
}

/** Physical deletion supports privacy/erasure of individual professional facts. */
export async function deleteEvidence(userId: string, id: string, revision: number) {
  const result = await prisma.careerEvidence.deleteMany({ where: { userId, id, revision } });
  if (result.count !== 1) {
    await ownedCurrent(userId, id); // Distinguish missing/foreign from outdated revision.
    throw conflict();
  }
  return { deleted: true };
}
