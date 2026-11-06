-- Packaged modules per business (Tienda de módulos / Syncro central) and per-business features
CREATE TABLE IF NOT EXISTS "BusinessModule" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "moduleCode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "origin" TEXT NOT NULL DEFAULT 'REQUEST',
  "trialEndsAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessModule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessModule_businessId_moduleCode_key" ON "BusinessModule"("businessId", "moduleCode");
CREATE INDEX IF NOT EXISTS "BusinessModule_status_idx" ON "BusinessModule"("status");
DO $$ BEGIN
  ALTER TABLE "BusinessModule" ADD CONSTRAINT "BusinessModule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "BusinessFeature" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "moduleCode" TEXT NOT NULL,
  "featureKey" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessFeature_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessFeature_businessId_featureKey_key" ON "BusinessFeature"("businessId", "featureKey");
DO $$ BEGIN
  ALTER TABLE "BusinessFeature" ADD CONSTRAINT "BusinessFeature_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Businesses that already use the gym keep it, now as an active module
INSERT INTO "BusinessModule" ("id", "businessId", "moduleCode", "status", "origin", "activatedAt", "updatedAt")
SELECT gen_random_uuid()::text, s."businessId", 'gym', 'ACTIVE', 'MIGRATION', now(), now()
FROM "Setting" s
WHERE s."businessId" IS NOT NULL
  AND s."enabledModules" IS NOT NULL
  AND s."enabledModules"::jsonb ? 'gym'
ON CONFLICT ("businessId", "moduleCode") DO NOTHING;
