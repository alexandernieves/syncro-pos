-- Keys for the WhatsApp agent (Koenyx) to call the gym API.
-- Additive only. Safe to run more than once.

CREATE TABLE IF NOT EXISTS "GymApiKey" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GymApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GymApiKey_keyPrefix_key" ON "GymApiKey"("keyPrefix");

CREATE INDEX IF NOT EXISTS "GymApiKey_business_idx" ON "GymApiKey"("businessId");

DO $$ BEGIN
  ALTER TABLE "GymApiKey" ADD CONSTRAINT "GymApiKey_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
