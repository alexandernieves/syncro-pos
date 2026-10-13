-- Koenyx agent: branch hours and map pin, classes open to trials, chats that need a person, payments reported by members.
-- Additive only. Safe to run more than once.

ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "openingHours" TEXT;

ALTER TABLE "GymClass" ADD COLUMN IF NOT EXISTS "allowTrial" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "WhatsAppChat" ADD COLUMN IF NOT EXISTS "attentionAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "attentionReason" TEXT,
ADD COLUMN IF NOT EXISTS "needsAttention" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "GymReportedPayment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "memberId" TEXT NOT NULL,
    "planId" TEXT,
    "planName" TEXT,
    "amountText" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "currency" TEXT,
    "bank" TEXT,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GymReportedPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GymReportedPayment_business_status_idx" ON "GymReportedPayment"("businessId", "status");

DO $$ BEGIN
  ALTER TABLE "GymReportedPayment" ADD CONSTRAINT "GymReportedPayment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymReportedPayment" ADD CONSTRAINT "GymReportedPayment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymReportedPayment" ADD CONSTRAINT "GymReportedPayment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GymMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
