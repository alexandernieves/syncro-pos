-- Custom category and method of finance movements.
-- Additive only. Safe to run more than once.

ALTER TABLE "FinanceMovement" ADD COLUMN IF NOT EXISTS "categoryLabel" TEXT,
ADD COLUMN IF NOT EXISTS "methodLabel" TEXT;
