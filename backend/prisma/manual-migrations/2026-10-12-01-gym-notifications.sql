-- Gym class notices by WhatsApp (class cancelled or moved, spot from the waiting list).
-- Additive only. Safe to run more than once.
CREATE TABLE IF NOT EXISTS "GymNotification" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "memberId" TEXT,
  "sessionId" TEXT,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "phone" TEXT,
  "text" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GymNotification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GymNotification_business_created_idx" ON "GymNotification"("businessId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "GymNotification" ADD CONSTRAINT "GymNotification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "GymNotification" ADD CONSTRAINT "GymNotification_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GymMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
