/*
  Warnings:

  - You are about to drop the column `company` on the `CoverLetter` table. All the data in the column will be lost.
  - You are about to drop the column `content` on the `CoverLetter` table. All the data in the column will be lost.
  - You are about to drop the column `cvId` on the `CoverLetter` table. All the data in the column will be lost.
  - You are about to drop the column `jobTitle` on the `CoverLetter` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `CoverLetter` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `CoverLetter` table. All the data in the column will be lost.
  - Added the required column `body` to the `CoverLetter` table without a default value. This is not possible if the table is not empty.
  - Added the required column `introduction` to the `CoverLetter` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recipientName` to the `CoverLetter` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recipientTitle` to the `CoverLetter` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CoverLetter" DROP CONSTRAINT "CoverLetter_cvId_fkey";

-- AlterTable
ALTER TABLE "CoverLetter" DROP COLUMN "company",
DROP COLUMN "content",
DROP COLUMN "cvId",
DROP COLUMN "jobTitle",
DROP COLUMN "location",
DROP COLUMN "title",
ADD COLUMN     "body" TEXT NOT NULL,
ADD COLUMN     "companyAddress" TEXT,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "conclusion" TEXT,
ADD COLUMN     "introduction" TEXT NOT NULL,
ADD COLUMN     "positionTitle" TEXT,
ADD COLUMN     "recipientName" TEXT NOT NULL,
ADD COLUMN     "recipientTitle" TEXT NOT NULL,
ADD COLUMN     "senderAddress" TEXT,
ADD COLUMN     "senderEmail" TEXT,
ADD COLUMN     "senderName" TEXT,
ADD COLUMN     "senderPhone" TEXT;
