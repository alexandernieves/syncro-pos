-- Gym phase 3: prospects (CRM) and trial classes, staff availability and shifts, guest passes and visits.
-- Additive only. Safe to run more than once.

ALTER TABLE "GymPayment" ADD COLUMN IF NOT EXISTS "visitId" TEXT,
ALTER COLUMN "membershipId" DROP NOT NULL;

ALTER TABLE "GymPlan" ADD COLUMN IF NOT EXISTS "guestPassesPerMonth" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "GymTrainer" ADD COLUMN IF NOT EXISTS "hourlyRate" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'TRAINER';

CREATE TABLE IF NOT EXISTS "GymStaffAvailability" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    CONSTRAINT "GymStaffAvailability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GymStaffShift" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "area" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "clockInAt" TIMESTAMP(3),
    "clockOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GymStaffShift_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GymLead" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "documentId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'WALK_IN',
    "interest" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'NEW',
    "lostReason" TEXT,
    "notes" TEXT,
    "ownerName" TEXT,
    "nextFollowUpAt" TIMESTAMP(3),
    "trialSessionId" TEXT,
    "trialAt" TIMESTAMP(3),
    "memberId" TEXT,
    "wonAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GymLead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GymLeadActivity" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "userName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GymLeadActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GymVisit" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documentId" TEXT,
    "phone" TEXT,
    "hostMemberId" TEXT,
    "leadId" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedOutAt" TIMESTAMP(3),
    "createdById" TEXT,
    CONSTRAINT "GymVisit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GymStaffAvailability_staff_idx" ON "GymStaffAvailability"("staffId");

CREATE INDEX IF NOT EXISTS "GymStaffShift_business_starts_idx" ON "GymStaffShift"("businessId", "startsAt");

CREATE INDEX IF NOT EXISTS "GymStaffShift_staff_starts_idx" ON "GymStaffShift"("staffId", "startsAt");

CREATE INDEX IF NOT EXISTS "GymLead_business_stage_idx" ON "GymLead"("businessId", "stage");

CREATE INDEX IF NOT EXISTS "GymLead_trial_session_idx" ON "GymLead"("trialSessionId");

CREATE INDEX IF NOT EXISTS "GymLeadActivity_lead_created_idx" ON "GymLeadActivity"("leadId", "createdAt");

CREATE INDEX IF NOT EXISTS "GymVisit_business_checkin_idx" ON "GymVisit"("businessId", "checkedInAt");

CREATE INDEX IF NOT EXISTS "GymVisit_host_checkin_idx" ON "GymVisit"("hostMemberId", "checkedInAt");

DO $$ BEGIN
  ALTER TABLE "GymPayment" ADD CONSTRAINT "GymPayment_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "GymVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymStaffAvailability" ADD CONSTRAINT "GymStaffAvailability_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymStaffAvailability" ADD CONSTRAINT "GymStaffAvailability_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "GymTrainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymStaffShift" ADD CONSTRAINT "GymStaffShift_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymStaffShift" ADD CONSTRAINT "GymStaffShift_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "GymTrainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymLead" ADD CONSTRAINT "GymLead_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymLead" ADD CONSTRAINT "GymLead_trialSessionId_fkey" FOREIGN KEY ("trialSessionId") REFERENCES "GymClassSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymLead" ADD CONSTRAINT "GymLead_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GymMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymLeadActivity" ADD CONSTRAINT "GymLeadActivity_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymLeadActivity" ADD CONSTRAINT "GymLeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "GymLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymVisit" ADD CONSTRAINT "GymVisit_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymVisit" ADD CONSTRAINT "GymVisit_hostMemberId_fkey" FOREIGN KEY ("hostMemberId") REFERENCES "GymMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymVisit" ADD CONSTRAINT "GymVisit_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "GymLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "GymNotification" ADD COLUMN IF NOT EXISTS "leadId" TEXT;
