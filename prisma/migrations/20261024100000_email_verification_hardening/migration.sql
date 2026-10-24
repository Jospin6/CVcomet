-- Invalidate legacy plaintext email codes and require limited-lifetime, HMAC-protected codes.
ALTER TABLE "User"
  ADD COLUMN "verificationCodeExpiresAt" TIMESTAMP(3),
  ADD COLUMN "verificationCodeSentAt" TIMESTAMP(3),
  ADD COLUMN "verificationCodeAttempts" INTEGER NOT NULL DEFAULT 0;

UPDATE "User" SET "verificationCode" = NULL WHERE "verificationCode" IS NOT NULL;
