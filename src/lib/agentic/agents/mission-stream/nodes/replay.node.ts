import prisma from "../../../../../../prisma/prisma";
import { CareerContractError } from "@/lib/career-os/contracts";
import { MAX_PROGRESS_EVENTS_PER_ATTEMPT } from "../tools/events.tool";

/** Check mission ownership even if no run exists yet (subscriber can arrive before POST). */
export async function assertProgressMissionOwner(userId: string, missionId: string) {
  const owned = await prisma.careerMission.findFirst({ where: { id: missionId, userId }, select: { id: true } });
  if (!owned) throw new CareerContractError(404, "MISSION_NOT_FOUND");
}

export async function readMissionProgress(userId: string, missionId: string, requestKey: string, afterId = BigInt(0)) {
  const run = await prisma.careerMissionRun.findFirst({ where: { userId, missionId, requestKey },
    select: { id: true, status: true, attempt: true, leaseUntil: true, errorCode: true } });
  if (!run) return { found: false as const, events: [], status: "WAITING" as const, expired: false };
  const rows = await prisma.careerMissionProgressEvent.findMany({
    where: { userId, missionId, runId: run.id, attempt: run.attempt, id: { gt: afterId } },
    orderBy: { id: "asc" }, take: MAX_PROGRESS_EVENTS_PER_ATTEMPT,
    select: { id: true, kind: true, step: true, code: true, createdAt: true },
  });
  return { found: true as const, status: run.status, expired: run.status === "RUNNING" && run.leaseUntil <= new Date(),
    events: rows.map((e: { id: bigint; kind: string; step: string | null; code: string | null; createdAt: Date }) => ({ id: e.id.toString(), kind: e.kind, step: e.step ?? undefined,
      code: e.code ?? undefined, at: e.createdAt.toISOString() })) };
}
