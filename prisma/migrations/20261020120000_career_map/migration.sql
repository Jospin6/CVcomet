CREATE TABLE "CareerMap" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "cvId" TEXT,
  "title" TEXT NOT NULL, "preferences" JSONB NOT NULL, "profile" JSONB NOT NULL,
  "graph" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CareerMap_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CareerGoal" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "careerMapId" TEXT,
  "roleId" TEXT NOT NULL, "title" TEXT NOT NULL, "plan" JSONB NOT NULL,
  "completedStepIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CareerGoal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CareerMap_userId_updatedAt_idx" ON "CareerMap"("userId", "updatedAt");
CREATE INDEX "CareerGoal_userId_updatedAt_idx" ON "CareerGoal"("userId", "updatedAt");
CREATE UNIQUE INDEX "CareerGoal_userId_roleId_key" ON "CareerGoal"("userId", "roleId");
ALTER TABLE "CareerMap" ADD CONSTRAINT "CareerMap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerGoal" ADD CONSTRAINT "CareerGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerGoal" ADD CONSTRAINT "CareerGoal_careerMapId_fkey" FOREIGN KEY ("careerMapId") REFERENCES "CareerMap"("id") ON DELETE SET NULL ON UPDATE CASCADE;
