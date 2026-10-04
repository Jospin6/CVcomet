-- Additive only: preserve existing profile fields, relations and documents.
ALTER TABLE "User"
  ADD COLUMN "headline" TEXT,
  ADD COLUMN "careerGoal" TEXT,
  ADD COLUMN "experienceLevel" TEXT,
  ADD COLUMN "targetJobTitle" TEXT,
  ADD COLUMN "targetIndustry" TEXT,
  ADD COLUMN "targetCountry" TEXT,
  ADD COLUMN "preferredWorkMode" TEXT,
  ADD COLUMN "resumeSource" TEXT,
  ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3),
  ADD COLUMN "profileRevision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "awards" JSONB,
  ADD COLUMN "professionalLinks" JSONB;
