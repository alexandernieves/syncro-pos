-- Syncro Credit: the business's own rate (Bs per $1) for paying installments and loans from the app
-- Idempotent: safe to run more than once.
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "syncroCreditRateCustom" DOUBLE PRECISION;
