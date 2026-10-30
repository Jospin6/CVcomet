-- User-controlled career search preferences; kept independent from CV contents.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "jobPreferences" JSONB;
