CREATE TABLE "ResignationLetter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Resignation letter',
    "recipient" TEXT NOT NULL DEFAULT '',
    "company" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT 'Resignation',
    "body" TEXT NOT NULL DEFAULT '',
    "signature" TEXT NOT NULL DEFAULT '',
    "letterDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResignationLetter_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ResignationLetter_userId_updatedAt_idx" ON "ResignationLetter"("userId", "updatedAt");
ALTER TABLE "ResignationLetter" ADD CONSTRAINT "ResignationLetter_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
