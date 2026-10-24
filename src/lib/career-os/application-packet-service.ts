import prisma from "../../../prisma/prisma";
import { Prisma } from "@prisma/client";
import { CareerContractError } from "./contracts";
import { assertEditable, assertSourcesCurrent, decidePacket, draftApplicationEmail, intentHash, type PacketLanguage } from "./application-packet-policy";

type Actor = { id: string };
const missing = () => new CareerContractError(404, "PACKET_NOT_FOUND");
function packetSummary(packet: { id: string; jobId: string; cvId: string; coverLetterId: string | null; missionId: string | null; status: string; revision: number }) {
  return { id: packet.id, jobId: packet.jobId, cvId: packet.cvId, coverLetterId: packet.coverLetterId, missionId: packet.missionId, status: packet.status, revision: packet.revision };
}
type CreateInput = { requestKey: string; jobId: string; cvId: string; coverLetterId?: string; missionId?: string; language: PacketLanguage };

export async function packetOptions(actor: Actor) {
  const [jobs, resumes, letters, missions] = await Promise.all([
    prisma.jobOpportunity.findMany({ where: { userId: actor.id }, select: { id: true, title: true, company: true, sourceUrl: true }, orderBy: { updatedAt: "desc" }, take: 75 }),
    prisma.cv.findMany({ where: { conversation: { userId: actor.id } }, select: { id: true, title: true, revision: true }, orderBy: { updatedAt: "desc" }, take: 75 }),
    prisma.coverLetter.findMany({ where: { conversation: { userId: actor.id } }, select: { id: true, cvId: true, jobId: true, positionTitle: true, companyName: true }, orderBy: { updatedAt: "desc" }, take: 75 }),
    prisma.careerMission.findMany({ where: { userId: actor.id, status: "ACTIVE" }, select: { id: true, title: true }, orderBy: { updatedAt: "desc" }, take: 30 }),
  ]);
  return { jobs, resumes, letters, missions };
}

export async function createApplicationPacket(actor: Actor, body: CreateInput) {
  const hash = intentHash(body);
  const old = await prisma.careerApplicationPacket.findUnique({ where: { userId_requestKey: { userId: actor.id, requestKey: body.requestKey } } });
  if (old) {
    if (old.intentHash !== hash) throw new CareerContractError(409, "REQUEST_KEY_REUSED");
    return { packet: packetSummary(old), replayed: true };
  }
  const [job, cv, letter, mission, user] = await Promise.all([
    prisma.jobOpportunity.findFirst({ where: { id: body.jobId, userId: actor.id }, select: { id: true, title: true, company: true, updatedAt: true } }),
    prisma.cv.findFirst({ where: { id: body.cvId, conversation: { userId: actor.id } }, select: { id: true, revision: true } }),
    body.coverLetterId ? prisma.coverLetter.findFirst({ where: { id: body.coverLetterId, conversation: { userId: actor.id } }, select: { id: true, cvId: true, jobId: true, revision: true } }) : null,
    body.missionId ? prisma.careerMission.findFirst({ where: { id: body.missionId, userId: actor.id, status: "ACTIVE" }, select: { id: true } }) : null,
    prisma.user.findUnique({ where: { id: actor.id }, select: { name: true } }),
  ]);
  if (!job || !cv || (body.coverLetterId && !letter) || (body.missionId && !mission)) throw new CareerContractError(404, "RESOURCE_NOT_FOUND");
  if (letter && (letter.cvId !== cv.id || (letter.jobId && letter.jobId !== job.id))) throw new CareerContractError(409, "LETTER_JOB_RESUME_MISMATCH");
  const draft = draftApplicationEmail({ company: job.company, title: job.title, name: user?.name ?? null, language: body.language });
  try {
    const packet = await prisma.careerApplicationPacket.create({ data: {
      userId: actor.id, requestKey: body.requestKey, intentHash: hash, missionId: mission?.id,
      jobId: job.id, cvId: cv.id, coverLetterId: letter?.id,
      cvRevision: cv.revision, letterRevision: letter?.revision ?? null, jobUpdatedAt: job.updatedAt,
      subject: draft.subject, body: draft.body, language: body.language,
    } });
    return { packet: packetSummary(packet), replayed: false };
  } catch (error) {
    // A concurrent retry with the same request key must not create two packets.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const replay = await prisma.careerApplicationPacket.findUnique({ where: { userId_requestKey: { userId: actor.id, requestKey: body.requestKey } } });
      if (replay?.intentHash === hash) return { packet: packetSummary(replay), replayed: true };
      throw new CareerContractError(409, "REQUEST_KEY_REUSED");
    }
    throw error;
  }
}

export async function listApplicationPackets(actor: Actor, limit: number) {
  const rows = await prisma.careerApplicationPacket.findMany({ where: { userId: actor.id }, orderBy: { updatedAt: "desc" }, take: limit,
    select: { id: true, status: true, revision: true, createdAt: true, updatedAt: true, approvedAt: true, jobId: true, cvId: true, coverLetterId: true, missionId: true,
      job: { select: { title: true, company: true } } } });
  return { items: rows, nextCursor: null };
}

export async function getApplicationPacket(actor: Actor, id: string) {
  const packet = await prisma.careerApplicationPacket.findFirst({ where: { id, userId: actor.id }, include: {
    job: { select: { id: true, title: true, company: true, sourceUrl: true, updatedAt: true } },
    cv: { select: { id: true, title: true, revision: true } },
    coverLetter: { select: { id: true, positionTitle: true, revision: true } },
  } });
  if (!packet) throw missing();
  const { requestKey: _requestKey, intentHash: _intentHash, userId: _userId, ...safe } = packet;
  const sourceChanged = packet.cv.revision !== packet.cvRevision || packet.coverLetter?.revision !== (packet.letterRevision ?? undefined) || packet.job.updatedAt.getTime() !== packet.jobUpdatedAt.getTime();
  return { ...safe, sourceChanged, submissionPerformed: false, externalEmailSent: false };
}

export async function updateApplicationPacket(actor: Actor, id: string, body: { revision: number; subject: string; body: string; recipientEmail?: string | null }) {
  const result = await prisma.careerApplicationPacket.updateMany({ where: { id, userId: actor.id, status: "DRAFT", revision: body.revision },
    data: { subject: body.subject, body: body.body, recipientEmail: body.recipientEmail ?? null, revision: { increment: 1 } } });
  if (result.count !== 1) {
    const found = await prisma.careerApplicationPacket.findFirst({ where: { id, userId: actor.id }, select: { status: true, revision: true } });
    if (!found) throw missing();
    assertEditable(found.status, found.revision, body.revision);
    throw new CareerContractError(409, "PACKET_CHANGED");
  }
  return getApplicationPacket(actor, id);
}

export async function decideApplicationPacket(actor: Actor, id: string, expectedRevision: number, action: "approve" | "cancel", reviewed: boolean) {
  // Serializable + CAS: decision never accepts a stale packet or stale source revisions.
  try {
    return await prisma.$transaction(async tx => {
      const packet = await tx.careerApplicationPacket.findFirst({ where: { id, userId: actor.id } });
      if (!packet) throw missing();
      const status = decidePacket(packet.status, packet.revision, expectedRevision, action, reviewed);
      if (action === "approve") {
        const [cv, letter, job] = await Promise.all([
          tx.cv.findFirst({ where: { id: packet.cvId, conversation: { userId: actor.id } }, select: { revision: true } }),
          packet.coverLetterId ? tx.coverLetter.findFirst({ where: { id: packet.coverLetterId, conversation: { userId: actor.id } }, select: { revision: true, cvId: true, jobId: true } }) : null,
          tx.jobOpportunity.findFirst({ where: { id: packet.jobId, userId: actor.id }, select: { updatedAt: true } }),
        ]);
        if (!cv || !job || (packet.coverLetterId && !letter)) throw new CareerContractError(409, "PACKET_SOURCE_CHANGED");
        if (letter && (letter.cvId !== packet.cvId || (letter.jobId && letter.jobId !== packet.jobId))) throw new CareerContractError(409, "PACKET_SOURCE_CHANGED");
        assertSourcesCurrent(packet, { cvRevision: cv.revision, letterRevision: letter?.revision ?? null, jobUpdatedAt: job.updatedAt });
      }
      const changed = await tx.careerApplicationPacket.updateMany({ where: { id, userId: actor.id, revision: expectedRevision, status: "DRAFT" },
        data: { status, revision: { increment: 1 }, approvedAt: status === "READY" ? new Date() : null } });
      if (changed.count !== 1) throw new CareerContractError(409, "PACKET_CHANGED");
      return { id, status, revision: expectedRevision + 1, submissionPerformed: false, externalEmailSent: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") throw new CareerContractError(409, "PACKET_CHANGED");
    throw error;
  }
}

export async function deleteApplicationPacket(actor: Actor, id: string) {
  const removed = await prisma.careerApplicationPacket.deleteMany({ where: { id, userId: actor.id } });
  if (!removed.count) throw missing();
  return { deleted: true };
}
