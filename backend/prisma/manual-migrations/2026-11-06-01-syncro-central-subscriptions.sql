-- Syncro central: subscription due date, monthly fee, notes and payments per business
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "subscriptionEndsAt" TIMESTAMP(3);
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "monthlyFee" DOUBLE PRECISION;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "adminNotes" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "suspendedReason" TEXT;

CREATE TABLE IF NOT EXISTS "SubscriptionPayment" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "months" INTEGER NOT NULL DEFAULT 1,
  "method" TEXT,
  "reference" TEXT,
  "note" TEXT,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_businessId_createdAt_idx" ON "SubscriptionPayment"("businessId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The global audit page filters by business and date
CREATE INDEX IF NOT EXISTS "AuditLog_businessId_createdAt_idx" ON "AuditLog"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
