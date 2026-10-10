-- SyncroCredit limit policy: the owner sets the starting limit, the cap and the raise per paid debt.
-- Additive only. Safe to run more than once.
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "syncroCreditInitialLimit" DOUBLE PRECISION NOT NULL DEFAULT 30;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "syncroCreditMaxLimit" DOUBLE PRECISION NOT NULL DEFAULT 200;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "syncroCreditLimitStep" DOUBLE PRECISION NOT NULL DEFAULT 10;
