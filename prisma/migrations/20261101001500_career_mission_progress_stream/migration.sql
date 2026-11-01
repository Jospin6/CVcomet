-- Stage 18: metadata-only, owner-scoped progress log; no raw prompts or tool output.
CREATE TABLE "CareerMissionProgressEvent" (
  "id" BIGSERIAL NOT NULL,
  "userId" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL,
  "kind" VARCHAR(40) NOT NULL,
  "step" VARCHAR(80),
  "code" VARCHAR(60),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CareerMissionProgressEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CareerMissionProgressEvent_userId_missionId_runId_id_idx" ON "CareerMissionProgressEvent"("userId", "missionId", "runId", "id");
CREATE INDEX "CareerMissionProgressEvent_runId_attempt_id_idx" ON "CareerMissionProgressEvent"("runId", "attempt", "id");
ALTER TABLE "CareerMissionProgressEvent" ADD CONSTRAINT "CareerMissionProgressEvent_missionId_fkey"
  FOREIGN KEY ("missionId") REFERENCES "CareerMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerMissionProgressEvent" ADD CONSTRAINT "CareerMissionProgressEvent_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "CareerMissionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
