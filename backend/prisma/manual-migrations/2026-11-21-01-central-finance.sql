BEGIN;
CREATE TABLE IF NOT EXISTS "CentralFinanceEntry" (
  "scope" TEXT NOT NULL,
  "id" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "debit" TEXT NOT NULL,
  "credit" TEXT NOT NULL,
  "cents" INTEGER NOT NULL CHECK ("cents" > 0),
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("scope", "id"),
  CHECK ("debit" <> "credit")
);
CREATE INDEX IF NOT EXISTS "CentralFinanceEntry_scope_date_idx"
  ON "CentralFinanceEntry" ("scope", "date");
CREATE TABLE IF NOT EXISTS "CentralFinancePlan" (
  "scope" TEXT PRIMARY KEY,
  "data" JSONB NOT NULL
);
COMMIT;
