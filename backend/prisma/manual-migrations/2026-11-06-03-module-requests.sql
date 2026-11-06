-- Tienda de módulos: what business owners ask Syncro for, with its timeline
CREATE TABLE IF NOT EXISTS "ModuleRequest" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "requestedById" TEXT,
  "kind" TEXT NOT NULL,
  "moduleCode" TEXT,
  "title" TEXT NOT NULL,
  "trade" TEXT,
  "problem" TEXT NOT NULL,
  "currentProcess" TEXT,
  "extra" TEXT,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModuleRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ModuleRequest_businessId_createdAt_idx" ON "ModuleRequest"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "ModuleRequest_status_idx" ON "ModuleRequest"("status");
DO $$ BEGIN
  ALTER TABLE "ModuleRequest" ADD CONSTRAINT "ModuleRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ModuleRequestEvent" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "note" TEXT,
  "byRole" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModuleRequestEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ModuleRequestEvent_requestId_createdAt_idx" ON "ModuleRequestEvent"("requestId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "ModuleRequestEvent" ADD CONSTRAINT "ModuleRequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ModuleRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
