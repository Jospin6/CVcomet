-- Stage 20: safe cohort comparison. Historical observations cannot be attributed
-- to an engine: preserve UNKNOWN; account deletions still cascade through FK.
ALTER TABLE "CareerAgentObservation"
  ADD COLUMN "engine" VARCHAR(12) NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "CareerAgentObservation"
  ADD CONSTRAINT "CareerAgentObservation_engine_check"
  CHECK ("engine" IN ('UNKNOWN', 'GRAPH', 'LEGACY'));
CREATE INDEX "CareerAgentObservation_engine_createdAt_outcome_idx"
  ON "CareerAgentObservation"("engine", "createdAt", "outcome");
