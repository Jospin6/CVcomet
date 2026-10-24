-- Phase 04: proposals are separate from letters. Acceptance is the only mutation.
CREATE TYPE "CoverLetterAIProposalStatus" AS ENUM ('PENDING','APPLIED','DISCARDED');
CREATE TABLE "CoverLetterAIProposal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "letterId" TEXT NOT NULL,
  "baseRevision" INTEGER NOT NULL,
  "status" "CoverLetterAIProposalStatus" NOT NULL DEFAULT 'PENDING',
  "document" JSONB NOT NULL,
  "message" VARCHAR(1000) NOT NULL,
  "changes" JSONB NOT NULL,
  "evidenceRevisions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "CoverLetterAIProposal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CoverLetterAIProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CoverLetterAIProposal_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "CoverLetter"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CoverLetterAIProposal_baseRevision_nonnegative" CHECK ("baseRevision" >= 0)
);
CREATE INDEX "CoverLetterAIProposal_userId_letterId_status_idx" ON "CoverLetterAIProposal"("userId", "letterId", "status");
CREATE INDEX "CoverLetterAIProposal_expiresAt_idx" ON "CoverLetterAIProposal"("expiresAt");
