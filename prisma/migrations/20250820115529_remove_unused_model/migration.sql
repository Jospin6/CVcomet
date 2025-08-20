/*
  Warnings:

  - You are about to drop the `Authenticator` table. If the table is not empty, all the data it contains will be lost.
  - The required column `id` was added to the `Session` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropForeignKey
ALTER TABLE "Authenticator" DROP CONSTRAINT "Authenticator_userId_fkey";

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "id" TEXT NOT NULL,
ALTER COLUMN "sessionToken" DROP NOT NULL,
ALTER COLUMN "expires" DROP NOT NULL,
ADD CONSTRAINT "Session_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Verification" ALTER COLUMN "identifier" DROP NOT NULL,
ALTER COLUMN "expiresAt" DROP NOT NULL,
ALTER COLUMN "value" DROP NOT NULL;

-- DropTable
DROP TABLE "Authenticator";
