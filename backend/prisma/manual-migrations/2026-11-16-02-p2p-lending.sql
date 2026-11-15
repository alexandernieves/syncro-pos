-- Syncro Credit P2P lending: limits by level per lender, platform caps, chat per loan and reviews.
-- Idempotent: safe to run more than once.

-- Each lender: how much it lends by level {"4": 30, "3": 100, "2": 250, "1": 500}
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "loanLevelLimits" JSONB;

-- A lender's own limit for one client (overrides its table); null = by level
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "lendingLimit" DOUBLE PRECISION;

-- Settings of the whole platform, set from Syncro Central (key → JSON)
CREATE TABLE IF NOT EXISTS "PlatformSetting" (
  "key"       TEXT PRIMARY KEY,
  "value"     JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Chat between the client and the lender, one per loan (request → disbursed → collected)
CREATE TABLE IF NOT EXISTS "LoanMessage" (
  "id"           TEXT PRIMARY KEY,
  "loanId"       TEXT NOT NULL REFERENCES "Loan"("id") ON DELETE CASCADE,
  "fromClient"   BOOLEAN NOT NULL,
  "senderUserId" TEXT,
  "senderName"   TEXT NOT NULL,
  "text"         TEXT NOT NULL,
  "readAt"       TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LoanMessage_loanId_createdAt_idx" ON "LoanMessage"("loanId", "createdAt");

-- Stars and a comment, client → lender and lender → client, once per loan each way
CREATE TABLE IF NOT EXISTS "LoanReview" (
  "id"           TEXT PRIMARY KEY,
  "loanId"       TEXT NOT NULL REFERENCES "Loan"("id") ON DELETE CASCADE,
  "fromClient"   BOOLEAN NOT NULL,
  "businessId"   TEXT NOT NULL,
  "creditUserId" TEXT,
  "clientId"     TEXT NOT NULL,
  "stars"        INTEGER NOT NULL,
  "comment"      TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "LoanReview_once" ON "LoanReview"("loanId", "fromClient");
CREATE INDEX IF NOT EXISTS "LoanReview_businessId_idx" ON "LoanReview"("businessId");
CREATE INDEX IF NOT EXISTS "LoanReview_creditUserId_idx" ON "LoanReview"("creditUserId");
