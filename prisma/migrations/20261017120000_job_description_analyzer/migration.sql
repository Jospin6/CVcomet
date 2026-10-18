-- Additions preserve existing opportunities, matches, resumes and applications.
ALTER TABLE "JobOpportunity"
  ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'URL',
  ADD COLUMN "sourceName" TEXT,
  ADD COLUMN "originalText" TEXT,
  ADD COLUMN "analysis" JSONB,
  ADD COLUMN "documentDrafts" JSONB;
ALTER TABLE "JobMatch"
  ALTER COLUMN "overallScore" DROP NOT NULL,
  ALTER COLUMN "skillScore" DROP NOT NULL,
  ALTER COLUMN "keywordScore" DROP NOT NULL,
  ALTER COLUMN "experienceScore" DROP NOT NULL,
  ALTER COLUMN "educationScore" DROP NOT NULL,
  ADD COLUMN "fingerprint" TEXT,
  ADD COLUMN "result" JSONB,
  ADD COLUMN "tailoring" JSONB,
  ADD COLUMN "tailoredCvId" TEXT;
CREATE UNIQUE INDEX "JobMatch_fingerprint_key" ON "JobMatch"("fingerprint");
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_tailoredCvId_fkey" FOREIGN KEY ("tailoredCvId") REFERENCES "Cv"("id") ON DELETE SET NULL ON UPDATE CASCADE;
