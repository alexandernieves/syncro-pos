BEGIN;
CREATE TABLE IF NOT EXISTS "CentralFiscalRecord" (
  "scope" TEXT NOT NULL,
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "identity" TEXT NOT NULL,
  "tax" TEXT,
  "direction" TEXT,
  "reference" TEXT NOT NULL,
  "counterparty" TEXT,
  "date" TEXT NOT NULL,
  "period" TEXT,
  "dueDate" TEXT,
  "filedDate" TEXT,
  "paidDate" TEXT,
  "status" TEXT NOT NULL,
  "baseCents" INTEGER CHECK ("baseCents" >= 0),
  "vatCents" INTEGER CHECK ("vatCents" >= 0),
  "amountCents" INTEGER CHECK ("amountCents" >= 0),
  "rateCurrency" TEXT,
  "rate" DECIMAL(20, 8),
  "notes" TEXT,
  "invoiceId" TEXT,
  "support" BYTEA,
  "supportMime" TEXT,
  "actorId" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("scope", "id"),
  CHECK (("support" IS NULL) = ("supportMime" IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS "CentralFiscalRecord_scope_identity_key"
  ON "CentralFiscalRecord" ("scope", "identity");
CREATE INDEX IF NOT EXISTS "CentralFiscalRecord_scope_date_idx"
  ON "CentralFiscalRecord" ("scope", "date");
COMMIT;
