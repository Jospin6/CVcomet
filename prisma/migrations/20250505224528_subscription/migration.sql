-- AlterTable
ALTER TABLE "User" ADD COLUMN     "generationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isSubscribed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionId" TEXT;
