-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('CV', 'COVER_LETTER');

-- AlterTable
ALTER TABLE "CoverLetter" ADD COLUMN     "templateId" TEXT;

-- AlterTable
ALTER TABLE "Cv" ADD COLUMN     "templateId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currentTemplateId" TEXT;

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TemplateType" NOT NULL,
    "previewUrl" TEXT NOT NULL,
    "templateFile" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_currentTemplateId_fkey" FOREIGN KEY ("currentTemplateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cv" ADD CONSTRAINT "Cv_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverLetter" ADD CONSTRAINT "CoverLetter_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
