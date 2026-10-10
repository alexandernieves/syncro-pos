-- Gym WhatsApp reminders: per-business settings and a log so each reminder is sent once.
-- Additive only. Safe to run more than once.
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "gymSettings" JSONB;

CREATE TABLE IF NOT EXISTS "GymReminder" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
  "membershipId" TEXT NOT NULL REFERENCES "GymMembership"("id") ON DELETE CASCADE,
  "memberId" TEXT NOT NULL REFERENCES "GymMember"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "phone" TEXT,
  "error" TEXT,
  "manual" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "GymReminder_business_created_idx" ON "GymReminder"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "GymReminder_membership_kind_idx" ON "GymReminder"("membershipId", "kind");
