-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currentCoverLetterId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_currentCoverLetterId_fkey" FOREIGN KEY ("currentCoverLetterId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
