ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'HIRED';
ALTER TABLE "JobApplication" ADD COLUMN "country" TEXT, ADD COLUMN "workMode" TEXT, ADD COLUMN "contractType" TEXT, ADD COLUMN "currency" TEXT, ADD COLUMN "archivedAt" TIMESTAMP(3), ADD COLUMN "cvSnapshot" JSONB, ADD COLUMN "coverLetterSnapshot" JSONB;
ALTER TABLE "InterviewSession" ADD COLUMN "scheduledAt" TIMESTAMP(3), ADD COLUMN "timezone" TEXT, ADD COLUMN "format" TEXT, ADD COLUMN "contactPerson" TEXT, ADD COLUMN "preparationNotes" TEXT, ADD COLUMN "outcome" TEXT;
CREATE TABLE "ApplicationStatusEvent" ("id" TEXT NOT NULL, "applicationId" TEXT NOT NULL, "status" "ApplicationStatus" NOT NULL, "note" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ApplicationStatusEvent_pkey" PRIMARY KEY ("id"));
CREATE TABLE "ApplicationReminder" ("id" TEXT NOT NULL, "applicationId" TEXT NOT NULL, "dueAt" TIMESTAMP(3) NOT NULL, "note" TEXT, "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ApplicationReminder_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ApplicationStatusEvent_applicationId_createdAt_idx" ON "ApplicationStatusEvent"("applicationId", "createdAt");
CREATE INDEX "ApplicationReminder_applicationId_dueAt_idx" ON "ApplicationReminder"("applicationId", "dueAt");
ALTER TABLE "ApplicationStatusEvent" ADD CONSTRAINT "ApplicationStatusEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationReminder" ADD CONSTRAINT "ApplicationReminder_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
