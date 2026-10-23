-- Existing letters are kept for consultation. New letters are always created from a CV.
ALTER TABLE "CoverLetter"
  ADD COLUMN "cvId" TEXT,
  ADD COLUMN "design" JSONB,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "CoverLetter"
  ADD CONSTRAINT "CoverLetter_cvId_fkey"
  FOREIGN KEY ("cvId") REFERENCES "Cv"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CoverLetter_cvId_createdAt_idx" ON "CoverLetter"("cvId", "createdAt");
