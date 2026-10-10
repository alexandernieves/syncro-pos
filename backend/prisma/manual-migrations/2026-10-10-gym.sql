-- Gym module (phase 1): plans, members, memberships, payments and access log (used by the face reader later).
-- Additive only. Safe to run more than once.
CREATE TABLE IF NOT EXISTS "GymPlan" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "durationDays" INTEGER NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "color" TEXT,
  "maxFreezeDays" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "GymPlan_businessId_idx" ON "GymPlan"("businessId");

CREATE TABLE IF NOT EXISTS "GymMember" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
  "clientId" TEXT NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
  "memberNumber" INTEGER NOT NULL,
  "photoUrl" TEXT,
  "birthDate" TIMESTAMP(3),
  "gender" TEXT,
  "emergencyContact" TEXT,
  "emergencyPhone" TEXT,
  "medicalNotes" TEXT,
  "goal" TEXT,
  "notes" TEXT,
  "accessEnabled" BOOLEAN NOT NULL DEFAULT true,
  "deviceUserId" TEXT,
  "faceSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "GymMember_clientId_key" ON "GymMember"("clientId");
CREATE UNIQUE INDEX IF NOT EXISTS "GymMember_businessId_memberNumber_key" ON "GymMember"("businessId", "memberNumber");

CREATE TABLE IF NOT EXISTS "GymMembership" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
  "memberId" TEXT NOT NULL REFERENCES "GymMember"("id") ON DELETE CASCADE,
  "planId" TEXT NOT NULL REFERENCES "GymPlan"("id"),
  "planName" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "frozenAt" TIMESTAMP(3),
  "frozenDaysUsed" INTEGER NOT NULL DEFAULT 0,
  "cancelledAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "GymMembership_member_idx" ON "GymMembership"("memberId");
CREATE INDEX IF NOT EXISTS "GymMembership_business_end_idx" ON "GymMembership"("businessId", "endDate");

CREATE TABLE IF NOT EXISTS "GymPayment" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
  "membershipId" TEXT NOT NULL REFERENCES "GymMembership"("id") ON DELETE CASCADE,
  "amount" DOUBLE PRECISION NOT NULL,
  "method" TEXT NOT NULL,
  "reference" TEXT,
  "exchangeRate" DOUBLE PRECISION,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "GymPayment_business_created_idx" ON "GymPayment"("businessId", "createdAt");

CREATE TABLE IF NOT EXISTS "GymCheckIn" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
  "memberId" TEXT REFERENCES "GymMember"("id") ON DELETE SET NULL,
  "granted" BOOLEAN NOT NULL,
  "reason" TEXT,
  "method" TEXT NOT NULL DEFAULT 'MANUAL',
  "deviceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "GymCheckIn_business_created_idx" ON "GymCheckIn"("businessId", "createdAt");
