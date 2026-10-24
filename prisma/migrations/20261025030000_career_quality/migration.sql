-- Stage 13: PII-minimized Career Agent operational events and optional user feedback.
-- No resume contents, free-form feedback, model outputs, prompts or IPs are recorded.
CREATE TYPE "CareerAgentOutcome" AS ENUM ('COMPLETED', 'FAILED');
CREATE TYPE "CareerAgentPhase" AS ENUM ('PLAN', 'TOOLS', 'ANSWER');
CREATE TYPE "CareerAgentFeedback" AS ENUM ('HELPFUL', 'NOT_HELPFUL');

CREATE TABLE "CareerAgentObservation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "outcome" "CareerAgentOutcome" NOT NULL,
  "phase" "CareerAgentPhase" NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "toolCount" INTEGER NOT NULL DEFAULT 0,
  "errorCode" VARCHAR(60),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CareerAgentObservation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CareerAgentObservation_createdAt_idx" ON "CareerAgentObservation"("createdAt");
CREATE INDEX "CareerAgentObservation_userId_createdAt_idx" ON "CareerAgentObservation"("userId", "createdAt");
ALTER TABLE "CareerAgentObservation" ADD CONSTRAINT "CareerAgentObservation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerMissionRun" ADD COLUMN "feedbackRating" "CareerAgentFeedback";
ALTER TABLE "CareerMissionRun" ADD COLUMN "feedbackAt" TIMESTAMP(3);
CREATE INDEX "CareerMissionRun_feedbackAt_idx" ON "CareerMissionRun"("feedbackAt");
