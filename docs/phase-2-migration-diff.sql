-- AlterTable
ALTER TABLE "User" ADD COLUMN     "awards" JSONB,
ADD COLUMN     "careerGoal" TEXT,
ADD COLUMN     "experienceLevel" TEXT,
ADD COLUMN     "headline" TEXT,
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "preferredWorkMode" TEXT,
ADD COLUMN     "professionalLinks" JSONB,
ADD COLUMN     "profileRevision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "resumeSource" TEXT,
ADD COLUMN     "targetCountry" TEXT,
ADD COLUMN     "targetIndustry" TEXT,
ADD COLUMN     "targetJobTitle" TEXT;

