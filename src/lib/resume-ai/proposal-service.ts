import prisma from "../../../prisma/prisma";
import { ProfileError } from "@/lib/career-profile/http";
import { normalizeEditorResume } from "@/lib/resume-editor";
import { resumeConversationEditSchema, applyResumeConversationEdits } from "@/lib/resume-conversation";
import { proposalIsApplicable, reviewChanges, unsupportedNumericClaims } from "./review";
import { z } from "zod";

const editsSchema = z.array(resumeConversationEditSchema).min(1).max(14);
const evidenceSchema = z.array(z.object({ id: z.string().uuid(), revision: z.number().int().nonnegative() }).strict()).max(30);

export async function proposeResumeAI(input: {
  userId: string; cvId: string; revision: number;
  current: ReturnType<typeof normalizeEditorResume>;
  edited: ReturnType<typeof normalizeEditorResume>;
  edits: z.infer<typeof editsSchema>;
  message: string; summary: string[];
  evidence: Array<{ statement: string; id?: string; revision?: number }>;
  instruction: string;
}) {
  const edits = editsSchema.parse(input.edits);
  // Numbers introduced by generated text must have a user-controlled source; job ads are excluded.
  const { design: _design, ...candidateContent } = input.current;
  const missing = unsupportedNumericClaims(edits, [JSON.stringify(candidateContent), input.instruction, ...input.evidence.map(row => row.statement)]);
  if (missing.length) throw new ProfileError(422, "UNSUPPORTED_FACTS");
  const diff = reviewChanges(input.current, input.edited, edits);
  if (!diff.length) throw new ProfileError(422, "NO_CHANGES");
  const evidenceRevisions = input.evidence.filter((row): row is { id: string; revision: number; statement: string } => !!row.id && row.revision !== undefined).map(row => ({ id: row.id, revision: row.revision }));
  const expiresAt = new Date(Date.now() + 15 * 60_000);
  const proposal = await prisma.$transaction(async tx => {
    const live = await tx.cv.findFirst({ where: { id: input.cvId, conversation: { userId: input.userId } }, select: { revision: true } });
    if (!live) throw new ProfileError(404, "NOT_FOUND");
    if (live.revision !== input.revision) throw new ProfileError(409, "CONFLICT");
    // Replace any older unresolved proposals for this CV without ever modifying the CV itself.
    await tx.resumeAIProposal.updateMany({ where: { cvId: input.cvId, userId: input.userId, status: "PENDING" }, data: { status: "DISCARDED", decidedAt: new Date() } });
    return tx.resumeAIProposal.create({ data: { cvId: input.cvId, userId: input.userId,
      baseRevision: input.revision, edits: JSON.parse(JSON.stringify(edits)), message: input.message, summary: input.summary,
      evidenceRevisions: JSON.parse(JSON.stringify(evidenceRevisions)), expiresAt } });
  });
  return { proposalId: proposal.id, baseRevision: input.revision, expiresAt: proposal.expiresAt.toISOString(),
    preview: input.edited, diff };
}

export async function decideResumeAI(userId: string, cvId: string, proposalId: string, action: "accept" | "discard") {
  return prisma.$transaction(async tx => {
    const proposal = await tx.resumeAIProposal.findFirst({ where: { id: proposalId, cvId, userId } });
    if (!proposal) throw new ProfileError(404, "PROPOSAL_NOT_FOUND");
    if (proposal.status !== "PENDING") throw new ProfileError(409, "PROPOSAL_DECIDED");
    if (action === "discard") {
      const discarded = await tx.resumeAIProposal.updateMany({ where: { id: proposalId, userId, cvId, status: "PENDING" }, data: { status: "DISCARDED", decidedAt: new Date() } });
      if (!discarded.count) throw new ProfileError(409, "PROPOSAL_DECIDED");
      return { status: "discarded" as const };
    }
    const cv = await tx.cv.findFirst({ where: { id: cvId, conversation: { userId } } });
    if (!cv) throw new ProfileError(404, "NOT_FOUND");
    if (!proposalIsApplicable(proposal.status, proposal.expiresAt, proposal.baseRevision, cv.revision, new Date())) throw new ProfileError(409, "PROPOSAL_EXPIRED_OR_STALE");
    const references = evidenceSchema.parse(proposal.evidenceRevisions);
    if (references.length) {
      const confirmed = await tx.careerEvidence.findMany({ where: { userId, status: "CONFIRMED", id: { in: references.map(x => x.id) } }, select: { id: true, revision: true } });
      if (references.some(x => !confirmed.some(row => row.id === x.id && row.revision === x.revision))) throw new ProfileError(409, "EVIDENCE_CHANGED");
    }
    const edits = editsSchema.parse(proposal.edits);
    const edited = applyResumeConversationEdits(normalizeEditorResume(cv), edits);
    // Numeric checks were enforced before creating the immutable proposal; only unchanged revisions can apply it.
    const changed = await tx.cv.updateMany({ where: { id: cvId, revision: proposal.baseRevision, conversation: { userId } }, data: { ...edited, revision: { increment: 1 } } });
    if (!changed.count) throw new ProfileError(409, "CONFLICT");
    const locked = await tx.resumeAIProposal.updateMany({ where: { id: proposalId, userId, cvId, status: "PENDING" }, data: { status: "APPLIED", decidedAt: new Date() } });
    if (!locked.count) throw new ProfileError(409, "PROPOSAL_DECIDED");
    await tx.resumeVersion.create({ data: { cvId, label: "Before approved AI edit", snapshot: JSON.parse(JSON.stringify(cv)) } });
    const updated = await tx.cv.findUniqueOrThrow({ where: { id: cvId } });
    return { status: "applied" as const, document: updated, revision: updated.revision };
  }, { maxWait: 10000, timeout: 20000 });
}
