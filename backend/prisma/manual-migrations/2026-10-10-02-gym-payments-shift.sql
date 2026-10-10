-- Gym payments go into the open cash shift and the accounting ledger, like POS sales.
-- Additive only. Safe to run more than once.
ALTER TABLE "GymPayment" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "GymPayment" ADD COLUMN IF NOT EXISTS "shiftId" TEXT;
ALTER TABLE "GymPayment" ADD COLUMN IF NOT EXISTS "accountingEntryId" TEXT;
CREATE INDEX IF NOT EXISTS "GymPayment_shiftId_idx" ON "GymPayment"("shiftId");
