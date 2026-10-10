-- Gym classes: sessions moved to another time (keep their original slot) and one-time extra sessions.
-- Additive only. Safe to run more than once.
ALTER TABLE "GymClassSession" ADD COLUMN IF NOT EXISTS "originalStartsAt" TIMESTAMP(3);
ALTER TABLE "GymClassSession" ADD COLUMN IF NOT EXISTS "isExtra" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "GymClassSession_class_original_idx" ON "GymClassSession"("classId", "originalStartsAt");
