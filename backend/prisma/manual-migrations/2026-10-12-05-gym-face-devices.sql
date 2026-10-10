-- Gym phase 7: face readers (Hikvision) through the local bridge, and their recognition events.
-- Additive only. Safe to run more than once.

ALTER TABLE "GymMember" ADD COLUMN IF NOT EXISTS "faceError" TEXT;

CREATE TABLE IF NOT EXISTS "GymDevice" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'DS-K1T341CMFW',
    "location" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'VALIDITY',
    "doorNo" INTEGER NOT NULL DEFAULT 1,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "status" JSONB,
    "commands" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GymDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GymDeviceEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "serialNo" TEXT NOT NULL,
    "employeeNo" TEXT,
    "memberId" TEXT,
    "deviceGranted" BOOLEAN NOT NULL,
    "syncroGranted" BOOLEAN,
    "reason" TEXT,
    "minor" INTEGER,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GymDeviceEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GymDevice_keyPrefix_key" ON "GymDevice"("keyPrefix");

CREATE INDEX IF NOT EXISTS "GymDevice_business_idx" ON "GymDevice"("businessId");

CREATE INDEX IF NOT EXISTS "GymDeviceEvent_business_time_idx" ON "GymDeviceEvent"("businessId", "occurredAt");

CREATE UNIQUE INDEX IF NOT EXISTS "GymDeviceEvent_device_serial_key" ON "GymDeviceEvent"("deviceId", "serialNo");

DO $$ BEGIN
  ALTER TABLE "GymDevice" ADD CONSTRAINT "GymDevice_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymDeviceEvent" ADD CONSTRAINT "GymDeviceEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymDeviceEvent" ADD CONSTRAINT "GymDeviceEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "GymDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
