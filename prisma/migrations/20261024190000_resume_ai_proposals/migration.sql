-- Phase 03: model output is a draft, never a direct CV mutation.
CREATE TYPE "ResumeAIProposalStatus" AS ENUM ('PENDING','APPLIED','DISCARDED');
CREATE TABLE "ResumeAIProposal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "cvId" TEXT NOT NULL,
  "baseRevision" INTEGER NOT NULL,
  "status" "ResumeAIProposalStatus" NOT NULL DEFAULT 'PENDING',
  "edits" JSONB NOT NULL,
  "message" VARCHAR(1000) NOT NULL,
  "summary" JSONB NOT NULL,
  "evidenceRevisions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "ResumeAIProposal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ResumeAIProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ResumeAIProposal_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "Cv"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ResumeAIProposal_baseRevision_nonnegative" CHECK ("baseRevision" >= 0)
);
CREATE INDEX "ResumeAIProposal_userId_cvId_status_idx" ON "ResumeAIProposal"("userId", "cvId", "status");
CREATE INDEX "ResumeAIProposal_expiresAt_idx" ON "ResumeAIProposal"("expiresAt");
