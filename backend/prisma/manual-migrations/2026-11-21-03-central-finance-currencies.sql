BEGIN;
ALTER TABLE "CentralFinanceEntry"
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "nativeCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "rate" DECIMAL(20, 8),
  ADD COLUMN IF NOT EXISTS "toCurrency" TEXT,
  ADD COLUMN IF NOT EXISTS "toCents" INTEGER;

ALTER TABLE "CentralFinanceEntry" DROP CONSTRAINT IF EXISTS "CentralFinanceEntry_check";
ALTER TABLE "CentralFinanceEntry" DROP CONSTRAINT IF EXISTS "CentralFinanceEntry_distinct_sides";
ALTER TABLE "CentralFinanceEntry" ADD CONSTRAINT "CentralFinanceEntry_distinct_sides"
  CHECK ("debit" <> "credit" OR ("toCurrency" IS NOT NULL AND "toCurrency" <> "currency"));
COMMIT;
