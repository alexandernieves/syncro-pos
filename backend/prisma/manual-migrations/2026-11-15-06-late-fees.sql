-- Syncro Credit: charges for late installments (configured by each business)
-- Idempotent: safe to run more than once.

-- The business's policy (grace days, fees, late interest, custom charges, cap)
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "syncroCreditLateFees" JSONB;

-- How much of an installment's amount is late charges (amount - lateCharges = the original installment)
ALTER TABLE "LoanInstallment" ADD COLUMN IF NOT EXISTS "lateCharges" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Every charge applied, once per installment / kind / period (the unique index makes it impossible to charge twice)
CREATE TABLE IF NOT EXISTS "LoanLateCharge" (
  "id"            TEXT PRIMARY KEY,
  "installmentId" TEXT NOT NULL REFERENCES "LoanInstallment"("id") ON DELETE CASCADE,
  "loanId"        TEXT NOT NULL,
  "clientId"      TEXT NOT NULL,
  "businessId"    TEXT NOT NULL,
  "kind"          TEXT NOT NULL,
  "ref"           TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "period"        INTEGER NOT NULL DEFAULT 1,
  "amount"        DOUBLE PRECISION NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "LoanLateCharge_once" ON "LoanLateCharge"("installmentId", "kind", "ref", "period");
CREATE INDEX IF NOT EXISTS "LoanLateCharge_businessId_idx" ON "LoanLateCharge"("businessId");
CREATE INDEX IF NOT EXISTS "LoanLateCharge_clientId_idx" ON "LoanLateCharge"("clientId");
