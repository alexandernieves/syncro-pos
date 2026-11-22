BEGIN;

CREATE TABLE IF NOT EXISTS "CentralFinanceBotPhone" (
  "phone" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "workspace" TEXT NOT NULL CHECK ("workspace" IN ('personal', 'company')),
  "challengeHash" TEXT,
  "challengeUntil" TIMESTAMP(3),
  "awaiting" BOOLEAN NOT NULL DEFAULT false,
  "activeUntil" TIMESTAMP(3),
  "pending" JSONB,
  "history" JSONB,
  "memory" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CentralFinanceBotPhone_userId_idx" ON "CentralFinanceBotPhone" ("userId");

CREATE TABLE IF NOT EXISTS "CentralFinanceBotEvent" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CentralFinanceBotEvent_createdAt_idx" ON "CentralFinanceBotEvent" ("createdAt");

COMMIT;
