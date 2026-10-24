-- Phase 09: packets are draft/approved artifacts only; NEVER evidence of sending.
CREATE TYPE "CareerApplicationPacketStatus" AS ENUM ('DRAFT', 'READY', 'CANCELED');
CREATE TABLE "CareerApplicationPacket" (
 "id" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "requestKey" UUID NOT NULL,
 "intentHash" VARCHAR(64) NOT NULL,
 "missionId" TEXT,
 "jobId" TEXT NOT NULL,
 "cvId" TEXT NOT NULL,
 "coverLetterId" TEXT,
 "cvRevision" INTEGER NOT NULL,
 "letterRevision" INTEGER,
 "jobUpdatedAt" TIMESTAMP(3) NOT NULL,
 "subject" VARCHAR(300) NOT NULL,
 "body" VARCHAR(12000) NOT NULL,
 "recipientEmail" VARCHAR(254),
 "language" VARCHAR(2) NOT NULL,
 "status" "CareerApplicationPacketStatus" NOT NULL DEFAULT 'DRAFT',
 "revision" INTEGER NOT NULL DEFAULT 0,
 "approvedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "CareerApplicationPacket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CareerApplicationPacket_userId_requestKey_key" ON "CareerApplicationPacket"("userId", "requestKey");
CREATE INDEX "CareerApplicationPacket_userId_updatedAt_id_idx" ON "CareerApplicationPacket"("userId", "updatedAt", "id");
CREATE INDEX "CareerApplicationPacket_missionId_createdAt_idx" ON "CareerApplicationPacket"("missionId", "createdAt");
ALTER TABLE "CareerApplicationPacket" ADD CONSTRAINT "CareerApplicationPacket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerApplicationPacket" ADD CONSTRAINT "CareerApplicationPacket_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "CareerMission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CareerApplicationPacket" ADD CONSTRAINT "CareerApplicationPacket_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerApplicationPacket" ADD CONSTRAINT "CareerApplicationPacket_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "Cv"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerApplicationPacket" ADD CONSTRAINT "CareerApplicationPacket_coverLetterId_fkey" FOREIGN KEY ("coverLetterId") REFERENCES "CoverLetter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
