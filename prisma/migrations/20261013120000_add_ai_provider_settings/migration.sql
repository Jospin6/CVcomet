CREATE TYPE "AIProvider" AS ENUM ('OPENAI', 'GOOGLE', 'ANTHROPIC', 'HUGGINGFACE', 'GROQ');

CREATE TABLE "AISettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "activeProvider" "AIProvider" NOT NULL DEFAULT 'GOOGLE',
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AISettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIProviderConfig" (
    "provider" "AIProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "encryptedApiKey" TEXT,
    "useEnvironmentKey" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AIProviderConfig_pkey" PRIMARY KEY ("provider")
);

ALTER TABLE "AIUsage" ADD COLUMN "provider" TEXT;
