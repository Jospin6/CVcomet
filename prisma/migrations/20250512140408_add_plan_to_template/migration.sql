-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PAID');

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "plan" "Plan" NOT NULL DEFAULT 'FREE';
