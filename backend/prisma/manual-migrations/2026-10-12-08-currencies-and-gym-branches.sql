-- Cash per currency (USD, VES, EUR, COP), change out of the drawer, COP rate, and gym data per branch.
-- Additive only. Safe to run more than once.

ALTER TABLE "GymCheckIn" ADD COLUMN IF NOT EXISTS "branchId" TEXT;

ALTER TABLE "GymClass" ADD COLUMN IF NOT EXISTS "branchId" TEXT;

ALTER TABLE "GymClassSession" ADD COLUMN IF NOT EXISTS "branchId" TEXT;

ALTER TABLE "GymDevice" ADD COLUMN IF NOT EXISTS "branchId" TEXT;

ALTER TABLE "GymEquipment" ADD COLUMN IF NOT EXISTS "branchId" TEXT;

ALTER TABLE "GymLead" ADD COLUMN IF NOT EXISTS "branchId" TEXT;

ALTER TABLE "GymMember" ADD COLUMN IF NOT EXISTS "branchId" TEXT;

ALTER TABLE "GymPayment" ADD COLUMN IF NOT EXISTS "amountCurrency" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "currency" TEXT;

ALTER TABLE "GymPlan" ADD COLUMN IF NOT EXISTS "allBranches" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "GymStaffShift" ADD COLUMN IF NOT EXISTS "branchId" TEXT;

ALTER TABLE "GymTrainer" ADD COLUMN IF NOT EXISTS "branchId" TEXT;

ALTER TABLE "GymVisit" ADD COLUMN IF NOT EXISTS "branchId" TEXT;

ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "changeAmount" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "changeCurrency" TEXT,
ADD COLUMN IF NOT EXISTS "changeUsd" DOUBLE PRECISION;

ALTER TABLE "SalePayment" ADD COLUMN IF NOT EXISTS "amountCurrency" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "currency" TEXT;

ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "copRateManual" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "copUpdateDate" TEXT,
ADD COLUMN IF NOT EXISTS "exchangeRateCop" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "Shift" ADD COLUMN IF NOT EXISTS "countedCash" JSONB,
ADD COLUMN IF NOT EXISTS "expectedCash" JSONB,
ADD COLUMN IF NOT EXISTS "openingCash" JSONB;

CREATE INDEX IF NOT EXISTS "GymCheckIn_branch_idx" ON "GymCheckIn"("branchId");

CREATE INDEX IF NOT EXISTS "GymClass_branch_idx" ON "GymClass"("branchId");

CREATE INDEX IF NOT EXISTS "GymClassSession_branch_idx" ON "GymClassSession"("branchId");

CREATE INDEX IF NOT EXISTS "GymDevice_branch_idx" ON "GymDevice"("branchId");

CREATE INDEX IF NOT EXISTS "GymEquipment_branch_idx" ON "GymEquipment"("branchId");

CREATE INDEX IF NOT EXISTS "GymLead_branch_idx" ON "GymLead"("branchId");

CREATE INDEX IF NOT EXISTS "GymMember_branch_idx" ON "GymMember"("branchId");

CREATE INDEX IF NOT EXISTS "GymStaffShift_branch_idx" ON "GymStaffShift"("branchId");

CREATE INDEX IF NOT EXISTS "GymTrainer_branch_idx" ON "GymTrainer"("branchId");

CREATE INDEX IF NOT EXISTS "GymVisit_branch_idx" ON "GymVisit"("branchId");

DO $$ BEGIN
  ALTER TABLE "GymMember" ADD CONSTRAINT "GymMember_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymCheckIn" ADD CONSTRAINT "GymCheckIn_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymTrainer" ADD CONSTRAINT "GymTrainer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymClass" ADD CONSTRAINT "GymClass_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymClassSession" ADD CONSTRAINT "GymClassSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymStaffShift" ADD CONSTRAINT "GymStaffShift_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymLead" ADD CONSTRAINT "GymLead_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymVisit" ADD CONSTRAINT "GymVisit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymEquipment" ADD CONSTRAINT "GymEquipment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymDevice" ADD CONSTRAINT "GymDevice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Existing gym data belongs to each business's main branch (or its first branch)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['GymMember','GymClass','GymClassSession','GymTrainer','GymStaffShift','GymVisit','GymLead','GymEquipment','GymDevice','GymCheckIn'] LOOP
    EXECUTE format(
      'UPDATE %I x SET "branchId" = m.id FROM (SELECT DISTINCT ON ("businessId") "businessId", id FROM "Branch" WHERE "businessId" IS NOT NULL ORDER BY "businessId", "isMain" DESC, "createdAt" ASC) m WHERE x."businessId" = m."businessId" AND x."branchId" IS NULL', t);
  END LOOP;
END $$;
