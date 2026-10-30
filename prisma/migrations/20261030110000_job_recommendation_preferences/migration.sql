CREATE TABLE "JobRecommendationPreference" (
  "userId" TEXT NOT NULL,
  "filters" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobRecommendationPreference_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "JobRecommendationPreference"
  ADD CONSTRAINT "JobRecommendationPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
