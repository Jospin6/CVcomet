-- Shared, atomic hourly and monthly request-credit windows.
-- Existing daily generationCount remains the single legacy/UI daily counter.
CREATE TABLE "AiQuotaWindow" (
  "key" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "requests" INTEGER NOT NULL DEFAULT 0,
  "credits" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "AiQuotaWindow_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "AiQuotaWindow_userId_period_windowStart_idx" ON "AiQuotaWindow"("userId", "period", "windowStart");
ALTER TABLE "AiQuotaWindow" ADD CONSTRAINT "AiQuotaWindow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
