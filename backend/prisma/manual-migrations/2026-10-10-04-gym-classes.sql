-- Gym classes: trainers, weekly class schedule, dated sessions and member bookings.
-- Additive only. Safe to run more than once.
CREATE TABLE IF NOT EXISTS "GymTrainer" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "specialty" TEXT,
  "photoUrl" TEXT,
  "color" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "GymTrainer_businessId_idx" ON "GymTrainer"("businessId");

CREATE TABLE IF NOT EXISTS "GymClass" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "color" TEXT,
  "trainerId" TEXT REFERENCES "GymTrainer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "daysOfWeek" INTEGER[] NOT NULL DEFAULT '{}',
  "startTime" TEXT NOT NULL,
  "durationMin" INTEGER NOT NULL DEFAULT 60,
  "capacity" INTEGER NOT NULL DEFAULT 20,
  "room" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "GymClass_businessId_idx" ON "GymClass"("businessId");

CREATE TABLE IF NOT EXISTS "GymClassSession" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "classId" TEXT NOT NULL REFERENCES "GymClass"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "trainerId" TEXT REFERENCES "GymTrainer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "capacity" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "cancelReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "GymClassSession_classId_startsAt_key" ON "GymClassSession"("classId", "startsAt");
CREATE INDEX IF NOT EXISTS "GymClassSession_business_starts_idx" ON "GymClassSession"("businessId", "startsAt");

CREATE TABLE IF NOT EXISTS "GymBooking" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "sessionId" TEXT NOT NULL REFERENCES "GymClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "memberId" TEXT NOT NULL REFERENCES "GymMember"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'BOOKED',
  "source" TEXT NOT NULL DEFAULT 'STAFF',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "GymBooking_sessionId_memberId_key" ON "GymBooking"("sessionId", "memberId");
CREATE INDEX IF NOT EXISTS "GymBooking_member_idx" ON "GymBooking"("memberId");
