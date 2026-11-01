-- Explicitly saved, owner-scoped career preferences. No automatic transcript persistence.
CREATE TABLE "CareerAgentMemory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "key" VARCHAR(32) NOT NULL,
  "value" VARCHAR(120) NOT NULL,
  "allowedAgents" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CareerAgentMemory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CareerAgentMemory_valid_scopes" CHECK (
    cardinality("allowedAgents") BETWEEN 1 AND 3 AND
    "allowedAgents" <@ ARRAY['supervisor','resume','cover_letter']::TEXT[]
  ),
  CONSTRAINT "CareerAgentMemory_valid_key" CHECK (
    "key" IN ('response_language','response_style','target_role','target_country','target_industry','work_mode','cv_market')
  )
);
CREATE UNIQUE INDEX "CareerAgentMemory_userId_key_key" ON "CareerAgentMemory"("userId", "key");
CREATE INDEX "CareerAgentMemory_userId_updatedAt_idx" ON "CareerAgentMemory"("userId", "updatedAt");
ALTER TABLE "CareerAgentMemory" ADD CONSTRAINT "CareerAgentMemory_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
