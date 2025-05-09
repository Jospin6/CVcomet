/*
  Warnings:

  - You are about to drop the column `previewUrl` on the `Template` table. All the data in the column will be lost.
  - The `templateFile` column on the `Template` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Template" DROP COLUMN "previewUrl",
DROP COLUMN "templateFile",
ADD COLUMN     "templateFile" BYTEA;
