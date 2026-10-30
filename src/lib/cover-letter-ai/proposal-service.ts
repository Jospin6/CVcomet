import prisma from "../../../prisma/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ProfileError } from "@/lib/career-profile/http";
import { coverLetterContentSchema, coverLetterDesignSchema, normalizeCoverLetter, type CoverLetterDocument } from "@/lib/cover-letter-editor";
import { addedUnsupportedNumbers, letterProposalIsApplicable, letterReviewChanges, lockLetterIdentity, unsupportedJobTerms } from "./review";

const storedDocument = coverLetterContentSchema.extend({ design: coverLetterDesignSchema });
const evidenceSchema = z.array(z.object({ id: z.string().uuid(), revision: z.number().int().nonnegative() }).strict()).max(30);
const changesSchema = z.array(z.string().max(500)).max(12);
export type ConfirmedLetterEvidence = { statement: string; id?: string; revision?: number };

export function reviewLetterDraft(input: { before: CoverLetterDocument; after: CoverLetterDocument;
  evidence: ConfirmedLetterEvidence[]; requirements: string[]; }) {
  const edited = lockLetterIdentity(input.before, input.after);
  if (addedUnsupportedNumbers(input.before, edited, input.evidence.map(e => e.statement)).length) throw new ProfileError(422, "UNSUPPORTED_FACTS");
  if (unsupportedJobTerms(edited, input.before, input.requirements, input.evidence.map(e => e.statement)).length) throw new ProfileError(422, "UNSUPPORTED_FACTS");
  return { edited, diff: letterReviewChanges(input.before, edited) };
}

export async function proposeCoverLetterAI(input: { userId: string; letterId: string; revision: number;
  before: CoverLetterDocument; after: CoverLetterDocument; message: string; changes: string[];
  evidence: ConfirmedLetterEvidence[]; requirements: string[] }) {
  const { edited, diff } = reviewLetterDraft(input);
  if (!diff.length) return { status: "clarification" as const, message: input.message, changes: input.changes, revision: input.revision };
  const evidenceRevisions = evidenceSchema.parse(input.evidence.filter((row): row is { id: string; revision: number; statement: string } => !!row.id && row.revision !== undefined).map(row => ({ id: row.id, revision: row.revision })));
  const now = new Date();
  const result = await prisma.$transaction(async tx => {
    const letter = await tx.coverLetter.findFirst({ where: { id: input.letterId, conversation: { userId: input.userId } }, select: { revision: true } });
    if (!letter) throw new ProfileError(404, "NOT_FOUND");
    if (letter.revision !== input.revision) throw new ProfileError(409, "CONFLICT");
    if (evidenceRevisions.length) {
      const latest = await tx.careerEvidence.findMany({ where: { userId: input.userId, status: "CONFIRMED", id: { in: evidenceRevisions.map(x => x.id) } }, select: { id: true, revision: true } });
      if (evidenceRevisions.some(x => !latest.some(row => row.id === x.id && row.revision === x.revision))) throw new ProfileError(409, "EVIDENCE_CHANGED");
    }
    await tx.coverLetterAIProposal.updateMany({ where: { userId: input.userId, letterId: input.letterId, status: "PENDING" }, data: { status: "DISCARDED", decidedAt: now } });
    return tx.coverLetterAIProposal.create({ data: {
      userId: input.userId, letterId: input.letterId, baseRevision: input.revision,
      document: JSON.parse(JSON.stringify(storedDocument.parse(edited))) as Prisma.InputJsonValue,
      message: input.message.slice(0, 1000), changes: changesSchema.parse(input.changes),
      evidenceRevisions: JSON.parse(JSON.stringify(evidenceRevisions)) as Prisma.InputJsonValue,
      expiresAt: new Date(now.getTime() + 15 * 60_000),
    } });
  });
  return { status: "proposal" as const, proposalId: result.id, baseRevision: result.baseRevision,
    expiresAt: result.expiresAt.toISOString(), message: result.message, changes: input.changes,
    preview: edited, diff, evidenceDisclosure: "self-reported-career-profile" };
}

export async function getPendingCoverLetterAI(userId: string, letterId: string) {
  const letter = await prisma.coverLetter.findFirst({ where: { id: letterId, conversation: { userId } } });
  if (!letter) throw new ProfileError(404, "NOT_FOUND");
  const proposal = await prisma.coverLetterAIProposal.findFirst({ where: { letterId, userId, status: "PENDING", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!proposal || proposal.baseRevision !== letter.revision) return { status: "none" as const };
  const before = normalizeCoverLetter(letter as unknown as Record<string, unknown>);
  const preview = storedDocument.parse(proposal.document);
  return { status: "proposal" as const, proposalId: proposal.id, baseRevision: proposal.baseRevision,
    expiresAt: proposal.expiresAt.toISOString(), message: proposal.message, changes: changesSchema.parse(proposal.changes),
    preview, diff: letterReviewChanges(before, preview), evidenceDisclosure: "self-reported-career-profile" };
}

export async function decideCoverLetterAI(userId: string, letterId: string, proposalId: string, action: "accept" | "discard") {
  return prisma.$transaction(async tx => {
    const proposal = await tx.coverLetterAIProposal.findFirst({ where: { id: proposalId, letterId, userId } });
    if (!proposal) throw new ProfileError(404, "PROPOSAL_NOT_FOUND");
    if (proposal.status !== "PENDING") throw new ProfileError(409, "PROPOSAL_DECIDED");
    // Verify ownership even on discard; neither method can operate on another account's letter.
    const letter = await tx.coverLetter.findFirst({ where: { id: letterId, conversation: { userId } } });
    if (!letter) throw new ProfileError(404, "NOT_FOUND");
    if (action === "discard") {
      const discarded = await tx.coverLetterAIProposal.updateMany({ where: { id: proposalId, userId, letterId, status: "PENDING" }, data: { status: "DISCARDED", decidedAt: new Date() } });
      if (!discarded.count) throw new ProfileError(409, "PROPOSAL_DECIDED");
      return { status: "discarded" as const };
    }
    if (!letterProposalIsApplicable(proposal.status, proposal.expiresAt, proposal.baseRevision, letter.revision, new Date())) throw new ProfileError(409, "PROPOSAL_EXPIRED_OR_STALE");
    const references = evidenceSchema.parse(proposal.evidenceRevisions);
    if (references.length) {
      const confirmed = await tx.careerEvidence.findMany({ where: { userId, status: "CONFIRMED", id: { in: references.map(x => x.id) } }, select: { id: true, revision: true } });
      if (references.some(x => !confirmed.some(row => row.id === x.id && row.revision === x.revision))) throw new ProfileError(409, "EVIDENCE_CHANGED");
    }
    const approved = storedDocument.parse(proposal.document);
    const document = lockLetterIdentity(normalizeCoverLetter(letter as unknown as Record<string, unknown>), approved);
    const { design, ...content } = document;
    const updated = await tx.coverLetter.updateMany({ where: { id: letterId, revision: proposal.baseRevision, conversation: { userId } },
      data: { ...content, design: JSON.parse(JSON.stringify(design)) as Prisma.InputJsonValue, revision: { increment: 1 } } });
    if (!updated.count) throw new ProfileError(409, "CONFLICT");
    const locked = await tx.coverLetterAIProposal.updateMany({ where: { id: proposalId, userId, letterId, status: "PENDING" }, data: { status: "APPLIED", decidedAt: new Date() } });
    if (!locked.count) throw new ProfileError(409, "PROPOSAL_DECIDED");
    const saved = await tx.coverLetter.findUniqueOrThrow({ where: { id: letterId } });
    return { status: "applied" as const, document: saved, revision: saved.revision };
  }, { maxWait: 10000, timeout: 20000 });
}
