-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
