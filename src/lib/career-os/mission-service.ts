import { createHash, randomUUID } from "node:crypto";
import prisma from "../../../prisma/prisma";
import type { Prisma } from "@prisma/client";
import { CareerContractError } from "./contracts";
import type { CareerActor } from "./policy";
import { runCareerAgent } from "./agent-service";
import {
  MISSION_HISTORY_LIMIT, MISSION_LEASE_MS, MISSION_MAX_LIST,
  assertSameMissionRequest, contextFromCompletedRuns, requireApprovalDecision,
} from "./mission-policy";

type MissionOwner = Pick<CareerActor, "id">;
const notFound = () => new CareerContractError(404, "MISSION_NOT_FOUND");
const conflict = () => new CareerContractError(409, "MISSION_BUSY");

function missionOverview(m: { id: string; title: string; status: string; revision: number; createdAt: Date; updatedAt: Date; activeRunId: string | null }) {
  return { id: m.id, title: m.title, status: m.status, revision: m.revision,
    busy: !!m.activeRunId, createdAt: m.createdAt, updatedAt: m.updatedAt };
}

function publicRun(r: { id: string; requestKey: string; question: string; answer: string | null; status: string; steps: unknown; errorCode: string | null; feedbackRating: string | null; createdAt: Date; updatedAt: Date }) {
  // Never expose raw model outputs beyond the assistant answer or any tool records.
  return { id: r.id, requestKey: r.requestKey, question: r.question, answer: r.answer,
    status: r.status, steps: r.status === "COMPLETED" && Array.isArray(r.steps) ? r.steps : [],
    errorCode: r.errorCode, feedbackRating: r.status === "COMPLETED" ? r.feedbackRating : null, createdAt: r.createdAt, updatedAt: r.updatedAt };
}

export async function createCareerMission(actor: MissionOwner, title: string) {
  const existing = await prisma.careerMission.count({ where: { userId: actor.id } });
  if (existing >= MISSION_MAX_LIST) throw new CareerContractError(409, "MISSION_LIMIT_REACHED");
  const mission = await prisma.careerMission.create({ data: { userId: actor.id, title } });
  return missionOverview(mission);
}

export async function listCareerMissions(actor: MissionOwner, limit: number, cursor?: string) {
  if (cursor && !(await prisma.careerMission.findFirst({ where: { id: cursor, userId: actor.id }, select: { id: true } }))) throw notFound();
  const items = await prisma.careerMission.findMany({ where: { userId: actor.id },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, title: true, status: true, revision: true, activeRunId: true, createdAt: true, updatedAt: true },
  });
  return { items: items.slice(0, limit).map(missionOverview), nextCursor: items.length > limit ? items[limit - 1].id : null };
}

export async function getCareerMission(actor: MissionOwner, missionId: string) {
  const mission = await prisma.careerMission.findFirst({ where: { id: missionId, userId: actor.id },
    include: { runs: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 31 },
      approvals: { orderBy: { createdAt: "desc" }, take: 20, select: {
        id: true, action: true, summary: true, status: true, expiresAt: true, createdAt: true, decidedAt: true,
      } } },
  });
  if (!mission) throw notFound();
  const latest = mission.runs.slice(0, 30);
  return { ...missionOverview(mission), runs: latest.reverse().map(publicRun),
    nextRunCursor: mission.runs.length > 30 ? latest[0].id : null, approvals: mission.approvals };
}

/** Page backwards through all retained mission turns without loading another account's records. */
export async function listCareerMissionRuns(actor: MissionOwner, missionId: string, limit: number, cursor?: string) {
  const owner = await prisma.careerMission.findFirst({ where: { id: missionId, userId: actor.id }, select: { id: true } });
  if (!owner) throw notFound();
  if (cursor && !(await prisma.careerMissionRun.findFirst({ where: { id: cursor, userId: actor.id, missionId }, select: { id: true } }))) throw notFound();
  const rows = await prisma.careerMissionRun.findMany({ where: { missionId, userId: actor.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
  const selected = rows.slice(0, limit);
  return { items: selected.reverse().map(publicRun), nextCursor: rows.length > limit ? selected[0].id : null };
}

/** Recover an abandoned lease only if it is truly expired; never steal a live worker's lock. */
async function releaseExpiredRun(tx: Prisma.TransactionClient, actorId: string, missionId: string, activeRunId: string | null, now: Date) {
  if (!activeRunId) return;
  const run = await tx.careerMissionRun.findFirst({ where: { id: activeRunId, userId: actorId, missionId } });
  if (run?.status === "RUNNING" && run.leaseUntil > now) throw conflict();
  if (run?.status === "RUNNING") {
    const stopped = await tx.careerMissionRun.updateMany({ where: { id: run.id, userId: actorId, status: "RUNNING", leaseToken: run.leaseToken, leaseUntil: { lte: now } },
      data: { status: "FAILED", errorCode: "MISSION_INTERRUPTED" } });
    if (stopped.count !== 1) throw conflict();
  }
  const freed = await tx.careerMission.updateMany({ where: { id: missionId, userId: actorId, activeRunId }, data: { activeRunId: null } });
  if (freed.count !== 1) throw conflict();
}

export async function updateCareerMission(actor: MissionOwner, id: string, expectedRevision: number, patch: { action: "rename" | "archive" | "restore"; title?: string }) {
  return prisma.$transaction(async tx => {
    const mission = await tx.careerMission.findFirst({ where: { id, userId: actor.id } });
    if (!mission) throw notFound();
    if (mission.revision !== expectedRevision) throw new CareerContractError(409, "MISSION_STALE_REVISION");
    await releaseExpiredRun(tx, actor.id, id, mission.activeRunId, new Date());
    const changed = await tx.careerMission.updateMany({ where: { id, userId: actor.id, revision: expectedRevision, activeRunId: null },
      data: { revision: { increment: 1 }, ...(patch.action === "rename" ? { title: patch.title! } : { status: patch.action === "archive" ? "ARCHIVED" : "ACTIVE" }) } });
    if (changed.count !== 1) throw conflict();
    const result = await tx.careerMission.findFirst({ where: { id, userId: actor.id } });
    if (!result) throw notFound();
    return missionOverview(result);
  });
}

export async function deleteCareerMission(actor: MissionOwner, id: string) {
  return prisma.$transaction(async tx => {
    const mission = await tx.careerMission.findFirst({ where: { id, userId: actor.id } });
    if (!mission) throw notFound();
    await releaseExpiredRun(tx, actor.id, id, mission.activeRunId, new Date());
    const deleted = await tx.careerMission.deleteMany({ where: { id, userId: actor.id, activeRunId: null } });
    if (deleted.count !== 1) throw conflict();
    return { deleted: true };
  });
}

type Claim = { kind: "cached"; answer: ReturnType<typeof publicRun> } | { kind: "claimed"; runId: string; leaseToken: string };

async function claimMissionRun(actor: MissionOwner, missionId: string, requestKey: string, message: string): Promise<Claim> {
  const now = new Date();
  const leaseToken = randomUUID();
  const leaseUntil = new Date(now.getTime() + MISSION_LEASE_MS);
  return prisma.$transaction(async tx => {
    const mission = await tx.careerMission.findFirst({ where: { id: missionId, userId: actor.id } });
    if (!mission) throw notFound();
    if (mission.status !== "ACTIVE") throw new CareerContractError(409, "MISSION_ARCHIVED");
    const prior = await tx.careerMissionRun.findUnique({ where: { missionId_requestKey: { missionId, requestKey } } });
    if (prior) {
      assertSameMissionRequest(prior.question, message);
      if (prior.status === "COMPLETED") return { kind: "cached", answer: publicRun(prior) };
    }
    await releaseExpiredRun(tx, actor.id, missionId, mission.activeRunId, now);
    let runId: string;
    if (prior) {
      const retried = await tx.careerMissionRun.updateMany({ where: { id: prior.id, userId: actor.id, missionId, status: "FAILED" },
        data: { status: "RUNNING", errorCode: null, leaseUntil, leaseToken, attempt: { increment: 1 } } });
      if (retried.count !== 1) throw conflict();
      runId = prior.id;
    } else {
      const created = await tx.careerMissionRun.create({ data: { missionId, userId: actor.id, requestKey, question: message, leaseToken, leaseUntil } });
      runId = created.id;
    }
    const locked = await tx.careerMission.updateMany({ where: { id: missionId, userId: actor.id, status: "ACTIVE", activeRunId: null },
      data: { activeRunId: runId, revision: { increment: 1 } } });
    if (locked.count !== 1) throw conflict();
    return { kind: "claimed", runId, leaseToken };
  }).catch((error: unknown) => {
    if (error && typeof error === "object" && "code" in error && (error.code === "P2002" || error.code === "P2034")) throw conflict();
    throw error;
  });
}

/** Store only sanitized summaries of read tools; never persist raw private tool results. */
export async function executeCareerMissionRun(actor: CareerActor, missionId: string, requestKey: string, message: string, signal?: AbortSignal, applicationId?: string) {
  const claim = await claimMissionRun(actor, missionId, requestKey, message);
  if (claim.kind === "cached") return { ...claim.answer, replayed: true };
  try {
    const history = await prisma.careerMissionRun.findMany({ where: { missionId, userId: actor.id, status: "COMPLETED" },
      select: { question: true, answer: true }, orderBy: { createdAt: "desc" }, take: MISSION_HISTORY_LIMIT });
    const result = await runCareerAgent(actor, message, signal, contextFromCompletedRuns(history.reverse().filter((r): r is { question: string; answer: string } => !!r.answer)), applicationId);
    const saved = await prisma.$transaction(async tx => {
      const done = await tx.careerMissionRun.updateMany({ where: { id: claim.runId, missionId, userId: actor.id, status: "RUNNING", leaseToken: claim.leaseToken },
        data: { answer: result.message, steps: result.steps, status: "COMPLETED", errorCode: null } });
      if (done.count !== 1) throw conflict();
      const unlocked = await tx.careerMission.updateMany({ where: { id: missionId, userId: actor.id, activeRunId: claim.runId },
        data: { activeRunId: null, revision: { increment: 1 } } });
      if (unlocked.count !== 1) throw conflict();
      return tx.careerMissionRun.findFirst({ where: { id: claim.runId, missionId, userId: actor.id } });
    });
    if (!saved) throw notFound();
    return { ...publicRun(saved), replayed: false };
  } catch (error) {
    const errorCode = error instanceof CareerContractError ? error.code : "AGENT_FAILED";
    // If the lease was reclaimed, do not overwrite another run's status.
    try {
      await prisma.$transaction(async tx => {
        const stopped = await tx.careerMissionRun.updateMany({ where: { id: claim.runId, userId: actor.id, missionId, status: "RUNNING", leaseToken: claim.leaseToken },
          data: { status: "FAILED", errorCode } });
        if (stopped.count) await tx.careerMission.updateMany({ where: { id: missionId, userId: actor.id, activeRunId: claim.runId }, data: { activeRunId: null, revision: { increment: 1 } } });
      });
    } catch { /* Preserve the original failure; lease recovery remains possible. */ }
    throw error;
  }
}

function digestAction(action: string, payload: unknown): string {
  // Canonical sorted JSON, no raw payload stored in approval rows.
  function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
    return value;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new CareerContractError(400, "INVALID_APPROVAL_PAYLOAD");
  const serialized = JSON.stringify({ action, payload: canonical(payload) });
  if (!serialized || serialized.length > 12000) throw new CareerContractError(400, "INVALID_APPROVAL_PAYLOAD");
  return createHash("sha256").update(serialized).digest("hex");
}

type ApprovalAction = "DRAFT_RESUME_CHANGES" | "DRAFT_COVER_LETTER" | "SUBMIT_APPLICATION" | "SEND_APPLICATION_EMAIL";
/** Trusted SERVER-ONLY workflow hook. No public route issues arbitrary approvals. */
export async function proposeCareerApproval(actor: CareerActor, missionId: string, action: ApprovalAction, payload: unknown, summary: string) {
  if (summary.trim().length < 5 || summary.length > 240) throw new CareerContractError(400, "INVALID_APPROVAL_SUMMARY");
  const mission = await prisma.careerMission.findFirst({ where: { id: missionId, userId: actor.id, status: "ACTIVE" } });
  if (!mission) throw notFound();
  return prisma.careerMissionApproval.create({ data: { userId: actor.id, missionId, action,
    payloadHash: digestAction(action, payload), summary: summary.trim(), expiresAt: new Date(Date.now() + 15 * 60_000) },
    select: { id: true, action: true, summary: true, status: true, expiresAt: true } });
}

export async function decideCareerApproval(actor: MissionOwner, missionId: string, approvalId: string, decision: "approve" | "reject") {
  const item = await prisma.careerMissionApproval.findFirst({ where: { id: approvalId, missionId, userId: actor.id, mission: { userId: actor.id, status: "ACTIVE" } } });
  if (!item) throw new CareerContractError(404, "APPROVAL_NOT_FOUND");
  const now = new Date();
  const status = requireApprovalDecision(item.status, item.expiresAt, now, decision);
  const changed = await prisma.careerMissionApproval.updateMany({ where: { id: approvalId, missionId, userId: actor.id,
    mission: { userId: actor.id, status: "ACTIVE" }, status: "PENDING", expiresAt: { gt: now } }, data: { status, decidedAt: now } });
  if (changed.count !== 1) throw new CareerContractError(409, "APPROVAL_ALREADY_DECIDED");
  return { id: item.id, action: item.action, summary: item.summary, status, decidedAt: now,
    actionExecuted: false }; // Approvals do not themselves enable side-effect tools.
}

/** Future write tools must additionally check their own authorization and use this one-time CAS. */
export async function consumeCareerApproval(actor: MissionOwner, missionId: string, approvalId: string, action: ApprovalAction, payload: unknown) {
  const now = new Date();
  const consumed = await prisma.careerMissionApproval.updateMany({ where: { id: approvalId, missionId, userId: actor.id,
    action, payloadHash: digestAction(action, payload), status: "APPROVED", expiresAt: { gt: now },
    mission: { userId: actor.id, status: "ACTIVE" } }, data: { status: "CONSUMED", consumedAt: now } });
  if (consumed.count !== 1) throw new CareerContractError(403, "APPROVAL_INVALID_OR_CONSUMED");
  // This function ONLY consumes the proof of approval; the caller implements any effect.
  return { consumed: true };
}
