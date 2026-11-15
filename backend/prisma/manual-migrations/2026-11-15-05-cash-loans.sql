-- Cash loans (module "loans"): lenders publish offers in Syncro Credit, clients request, the lender
-- approves, the client picks the cash up at the POS with a PIN. Additive only. Safe to run more than once.
ALTER TYPE "LoanStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "LoanStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

CREATE TABLE IF NOT EXISTS "LoanOffer" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "minAmount" DOUBLE PRECISION NOT NULL,
  "maxAmount" DOUBLE PRECISION NOT NULL,
  "interestPct" DOUBLE PRECISION NOT NULL,
  "installments" INTEGER NOT NULL DEFAULT 1,
  "frequencyDays" INTEGER NOT NULL DEFAULT 7,
  "minLevel" INTEGER NOT NULL DEFAULT 4,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoanOffer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LoanOffer_businessId_active_idx" ON "LoanOffer"("businessId", "active");
DO $$ BEGIN
  ALTER TABLE "LoanOffer" ADD CONSTRAINT "LoanOffer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'PURCHASE';
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "businessId" TEXT;
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "offerId" TEXT;
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "frequencyDays" INTEGER;
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "pin" TEXT;
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "pinExpiresAt" TIMESTAMP(3);
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "decidedAt" TIMESTAMP(3);
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "decidedBy" TEXT;
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "rejectReason" TEXT;
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "disbursedAt" TIMESTAMP(3);
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "disbursedBy" TEXT;
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "disbursedBranchId" TEXT;
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "bills" JSONB;
CREATE INDEX IF NOT EXISTS "Loan_businessId_kind_status_idx" ON "Loan"("businessId", "kind", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "Loan_businessId_pin_key" ON "Loan"("businessId", "pin");

-- Syncro Credit accounts: one per person (by cédula), self-registered in the app. Each business
-- the person deals with keeps its own Client row, linked here.
CREATE TABLE IF NOT EXISTS "CreditUser" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "password" TEXT NOT NULL,
  "phoneVerifiedAt" TIMESTAMP(3),
  "otpCode" TEXT,
  "otpExpires" TIMESTAMP(3),
  "pendingPassword" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditUser_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CreditUser_documentId_key" ON "CreditUser"("documentId");
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "creditUserId" TEXT;
CREATE INDEX IF NOT EXISTS "Client_creditUserId_idx" ON "Client"("creditUserId");
