-- Phase 07: per-user opt-in persistent missions and replay-safe read-only runs.
CREATE TYPE "CareerMissionStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "CareerMissionRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "CareerMissionApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CONSUMED');
CREATE TYPE "CareerMissionApprovalAction" AS ENUM ('DRAFT_RESUME_CHANGES', 'DRAFT_COVER_LETTER', 'SUBMIT_APPLICATION', 'SEND_APPLICATION_EMAIL');

CREATE TABLE "CareerMission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "status" "CareerMissionStatus" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "activeRunId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CareerMission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CareerMission_userId_updatedAt_id_idx" ON "CareerMission"("userId", "updatedAt", "id");
ALTER TABLE "CareerMission" ADD CONSTRAINT "CareerMission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CareerMissionRun" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestKey" UUID NOT NULL,
    "question" VARCHAR(6000) NOT NULL,
    "answer" VARCHAR(10000),
    "steps" JSONB,
    "status" "CareerMissionRunStatus" NOT NULL DEFAULT 'RUNNING',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "leaseToken" UUID NOT NULL,
    "leaseUntil" TIMESTAMP(3) NOT NULL,
    "errorCode" VARCHAR(60),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CareerMissionRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CareerMissionRun_missionId_requestKey_key" ON "CareerMissionRun"("missionId", "requestKey");
CREATE INDEX "CareerMissionRun_missionId_createdAt_id_idx" ON "CareerMissionRun"("missionId", "createdAt", "id");
CREATE INDEX "CareerMissionRun_userId_status_idx" ON "CareerMissionRun"("userId", "status");
ALTER TABLE "CareerMissionRun" ADD CONSTRAINT "CareerMissionRun_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "CareerMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CareerMissionApproval" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "CareerMissionApprovalAction" NOT NULL,
    "payloadHash" VARCHAR(64) NOT NULL,
    "summary" VARCHAR(240) NOT NULL,
    "status" "CareerMissionApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CareerMissionApproval_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CareerMissionApproval_missionId_status_expiresAt_idx" ON "CareerMissionApproval"("missionId", "status", "expiresAt");
CREATE INDEX "CareerMissionApproval_userId_createdAt_idx" ON "CareerMissionApproval"("userId", "createdAt");
ALTER TABLE "CareerMissionApproval" ADD CONSTRAINT "CareerMissionApproval_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "CareerMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
