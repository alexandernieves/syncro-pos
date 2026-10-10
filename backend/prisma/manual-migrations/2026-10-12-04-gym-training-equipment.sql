-- Gym phase 5: equipment and maintenance, exercise library and routines, workout logs, body assessments.
-- Additive only. Safe to run more than once.

CREATE TABLE IF NOT EXISTS "GymEquipment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'STRENGTH',
    "brand" TEXT,
    "model" TEXT,
    "serial" TEXT,
    "area" TEXT,
    "photoUrl" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchasePrice" DOUBLE PRECISION,
    "warrantyUntil" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OK',
    "serviceEveryDays" INTEGER NOT NULL DEFAULT 0,
    "lastServiceAt" TIMESTAMP(3),
    "nextServiceAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GymEquipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GymMaintenance" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'REPAIR',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "reportedBy" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "cost" DOUBLE PRECISION,
    "vendor" TEXT,
    "resolution" TEXT,
    "accountingEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GymMaintenance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GymExercise" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "muscleGroup" TEXT NOT NULL,
    "equipment" TEXT,
    "instructions" TEXT,
    "videoUrl" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GymExercise_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GymRoutine" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "level" TEXT NOT NULL DEFAULT 'BEGINNER',
    "description" TEXT,
    "memberId" TEXT,
    "trainerId" TEXT,
    "templateId" TEXT,
    "days" JSONB NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GymRoutine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GymWorkoutLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "routineId" TEXT,
    "dayIndex" INTEGER,
    "dayName" TEXT,
    "entries" JSONB,
    "notes" TEXT,
    "doneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GymWorkoutLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GymAssessment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "trainerId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weightKg" DOUBLE PRECISION,
    "heightCm" DOUBLE PRECISION,
    "bodyFatPct" DOUBLE PRECISION,
    "muscleMassKg" DOUBLE PRECISION,
    "waistCm" DOUBLE PRECISION,
    "hipCm" DOUBLE PRECISION,
    "chestCm" DOUBLE PRECISION,
    "armCm" DOUBLE PRECISION,
    "thighCm" DOUBLE PRECISION,
    "restingHr" INTEGER,
    "bloodPressure" TEXT,
    "notes" TEXT,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GymAssessment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GymEquipment_business_idx" ON "GymEquipment"("businessId");

CREATE INDEX IF NOT EXISTS "GymMaintenance_business_status_idx" ON "GymMaintenance"("businessId", "status");

CREATE INDEX IF NOT EXISTS "GymMaintenance_equipment_idx" ON "GymMaintenance"("equipmentId");

CREATE INDEX IF NOT EXISTS "GymExercise_business_group_idx" ON "GymExercise"("businessId", "muscleGroup");

CREATE INDEX IF NOT EXISTS "GymRoutine_business_member_idx" ON "GymRoutine"("businessId", "memberId");

CREATE INDEX IF NOT EXISTS "GymWorkoutLog_member_done_idx" ON "GymWorkoutLog"("memberId", "doneAt");

CREATE INDEX IF NOT EXISTS "GymAssessment_member_date_idx" ON "GymAssessment"("memberId", "date");

DO $$ BEGIN
  ALTER TABLE "GymEquipment" ADD CONSTRAINT "GymEquipment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymMaintenance" ADD CONSTRAINT "GymMaintenance_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymMaintenance" ADD CONSTRAINT "GymMaintenance_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "GymEquipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymExercise" ADD CONSTRAINT "GymExercise_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymRoutine" ADD CONSTRAINT "GymRoutine_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymRoutine" ADD CONSTRAINT "GymRoutine_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GymMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymRoutine" ADD CONSTRAINT "GymRoutine_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "GymTrainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymWorkoutLog" ADD CONSTRAINT "GymWorkoutLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymWorkoutLog" ADD CONSTRAINT "GymWorkoutLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GymMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymWorkoutLog" ADD CONSTRAINT "GymWorkoutLog_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "GymRoutine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymAssessment" ADD CONSTRAINT "GymAssessment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymAssessment" ADD CONSTRAINT "GymAssessment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GymMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymAssessment" ADD CONSTRAINT "GymAssessment_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "GymTrainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
