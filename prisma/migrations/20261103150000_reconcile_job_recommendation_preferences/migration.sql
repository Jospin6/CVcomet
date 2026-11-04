-- Reconcile drift between _prisma_migrations and the live table without
-- dropping user preferences. The 20261030 migrations dropped and re-created
-- this table; a later manual change or a different Neon branch can leave it
-- absent even when `prisma migrate status` says that all migrations ran.
CREATE TABLE IF NOT EXISTS public."JobRecommendationPreference" (
  "userId" TEXT NOT NULL,
  "filters" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobRecommendationPreference_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "JobRecommendationPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES public."User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Repair missing non-key columns additively on an existing table. Existing
-- preferences are preserved. If filters was missing, an empty preference
-- object is safer than fabricating search requirements.
ALTER TABLE public."JobRecommendationPreference"
  ADD COLUMN IF NOT EXISTS "filters" JSONB;
ALTER TABLE public."JobRecommendationPreference"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
UPDATE public."JobRecommendationPreference"
   SET "filters" = '{}'::jsonb WHERE "filters" IS NULL;
UPDATE public."JobRecommendationPreference"
   SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;
ALTER TABLE public."JobRecommendationPreference"
  ALTER COLUMN "filters" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- An old/manual table can lack the key or foreign-key constraints. Restore
-- them if absent so that the SQL fallback's ON CONFLICT is reliable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public."JobRecommendationPreference"'::regclass
       AND contype = 'p'
  ) THEN
    ALTER TABLE public."JobRecommendationPreference"
      ADD CONSTRAINT "JobRecommendationPreference_pkey" PRIMARY KEY ("userId");
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public."JobRecommendationPreference"'::regclass
       AND conname = 'JobRecommendationPreference_userId_fkey'
  ) THEN
    ALTER TABLE public."JobRecommendationPreference"
      ADD CONSTRAINT "JobRecommendationPreference_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES public."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
