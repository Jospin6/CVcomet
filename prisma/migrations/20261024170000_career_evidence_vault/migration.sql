-- Phase 02: per-user professional evidence. No AI suggestion is implicitly verified.
CREATE TYPE "CareerEvidenceKind" AS ENUM ('SKILL','EXPERIENCE','EDUCATION','PROJECT','CERTIFICATION','ACHIEVEMENT','LANGUAGE','OTHER');
CREATE TYPE "CareerEvidenceStatus" AS ENUM ('DRAFT','CONFIRMED','REJECTED','REVOKED');
CREATE TYPE "CareerEvidenceSource" AS ENUM ('MANUAL','PROFILE_IMPORT','AI_SUGGESTION');
CREATE TABLE "CareerEvidence" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "CareerEvidenceKind" NOT NULL,
  "statement" VARCHAR(1600) NOT NULL,
  "source" "CareerEvidenceSource" NOT NULL DEFAULT 'MANUAL',
  "sourceLabel" VARCHAR(200),
  "sourceKey" VARCHAR(180),
  "status" "CareerEvidenceStatus" NOT NULL DEFAULT 'DRAFT',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "confirmedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CareerEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CareerEvidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CareerEvidence_statement_nonblank" CHECK (char_length(btrim("statement")) > 0),
  CONSTRAINT "CareerEvidence_revision_nonnegative" CHECK ("revision" >= 0),
  CONSTRAINT "CareerEvidence_confirmed_timestamp" CHECK ("status" <> 'CONFIRMED' OR "confirmedAt" IS NOT NULL)
);
CREATE UNIQUE INDEX "CareerEvidence_userId_sourceKey_key" ON "CareerEvidence"("userId", "sourceKey");
CREATE INDEX "CareerEvidence_userId_status_id_idx" ON "CareerEvidence"("userId", "status", "id");
CREATE INDEX "CareerEvidence_userId_kind_id_idx" ON "CareerEvidence"("userId", "kind", "id");
