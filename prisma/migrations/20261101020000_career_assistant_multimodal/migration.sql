-- Only metadata + digest are retained. File bytes, images and extracted content remain ephemeral.
ALTER TABLE "CareerMissionRun" ADD COLUMN "attachmentsMeta" JSONB, ADD COLUMN "inputDigest" VARCHAR(64), ADD COLUMN "specialist" VARCHAR(32);
