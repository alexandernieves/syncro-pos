-- Income and expenses that aren't sales (finance movements) and their rules.
-- Additive only. Safe to run more than once.

ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "financeSettings" JSONB;

CREATE TABLE IF NOT EXISTS "FinanceMovement" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amountCurrency" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "description" TEXT,
    "receiptUrl" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'DASHBOARD',
    "shiftId" TEXT,
    "accountingEntryId" TEXT,
    "authorizedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinanceMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FinanceMovement_branch_day_idx" ON "FinanceMovement"("businessId", "branchId", "occurredAt");

CREATE INDEX IF NOT EXISTS "FinanceMovement_shift_idx" ON "FinanceMovement"("shiftId");

DO $$ BEGIN
  ALTER TABLE "FinanceMovement" ADD CONSTRAINT "FinanceMovement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FinanceMovement" ADD CONSTRAINT "FinanceMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FinanceMovement" ADD CONSTRAINT "FinanceMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
