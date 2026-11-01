-- Stage 19: bounded administrative aggregates over the preceding 7 days.
-- Metadata-only indexes; no extra copies of private payloads are created.
CREATE INDEX "AIUsage_createdAt_idx" ON "AIUsage"("createdAt");
CREATE INDEX "CareerMissionRun_createdAt_status_idx" ON "CareerMissionRun"("createdAt", "status");
CREATE INDEX "CareerMissionProgressEvent_createdAt_kind_idx" ON "CareerMissionProgressEvent"("createdAt", "kind");
