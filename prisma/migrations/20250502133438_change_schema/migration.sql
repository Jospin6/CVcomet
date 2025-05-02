/*
  Warnings:

  - You are about to drop the column `description` on the `Education` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Experience` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the `Language` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Language" DROP CONSTRAINT "Language_userId_fkey";

-- AlterTable
ALTER TABLE "Education" DROP COLUMN "description";

-- AlterTable
ALTER TABLE "Experience" DROP COLUMN "description";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "description",
ADD COLUMN     "end" TEXT,
ADD COLUMN     "start" TEXT,
ALTER COLUMN "url" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "languages" TEXT;

-- DropTable
DROP TABLE "Language";
