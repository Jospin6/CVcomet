-- Phase 00.4: cross-instance abuse prevention, verified Stripe webhook replay defense,
-- and reliable ownership cascade deletion. Apply after the previous Phase 00 migrations.
CREATE TABLE "BillingWebhookEvent" (
  "id" TEXT PRIMARY KEY, "type" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BillingWebhookEvent_processedAt_idx" ON "BillingWebhookEvent"("processedAt");
ALTER TABLE "Subscription" ADD COLUMN "lastStripeEventCreated" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "AuthThrottleWindow" (
  "key" TEXT PRIMARY KEY, "attempts" INTEGER NOT NULL DEFAULT 0,
  "resetsAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "AuthThrottleWindow_resetsAt_idx" ON "AuthThrottleWindow"("resetsAt");

-- Cascade personal records from account->conversation->CV/letters/messages.
-- Many newer user-owned models already cascade and are left unchanged.
ALTER TABLE "Conversation" DROP CONSTRAINT IF EXISTS "Conversation_userId_fkey";
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Cv" DROP CONSTRAINT IF EXISTS "Cv_conversationId_fkey";
ALTER TABLE "Cv" ADD CONSTRAINT "Cv_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoverLetter" DROP CONSTRAINT IF EXISTS "CoverLetter_conversationId_fkey";
ALTER TABLE "CoverLetter" ADD CONSTRAINT "CoverLetter_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" DROP CONSTRAINT IF EXISTS "Message_conversationId_fkey";
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Experience" DROP CONSTRAINT IF EXISTS "Experience_userId_fkey";
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Education" DROP CONSTRAINT IF EXISTS "Education_userId_fkey";
ALTER TABLE "Education" ADD CONSTRAINT "Education_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_userId_fkey";
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Certification" DROP CONSTRAINT IF EXISTS "Certification_userId_fkey";
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
