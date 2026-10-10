-- Gym phase 4: access rules per plan, scheduled freezes and extra charges, contracts and signatures.
-- Additive only. Safe to run more than once.

ALTER TABLE "GymMembership" ADD COLUMN IF NOT EXISTS "feeItems" JSONB,
ADD COLUMN IF NOT EXISTS "fees" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "freezeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "freezeFrom" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "freezeReason" TEXT,
ADD COLUMN IF NOT EXISTS "freezeUntil" TIMESTAMP(3);

ALTER TABLE "GymPlan" ADD COLUMN IF NOT EXISTS "accessWindows" JSONB,
ADD COLUMN IF NOT EXISTS "allowedClassIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "includesClasses" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "maxEntriesPerDay" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "maxEntriesPerWeek" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "totalEntries" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "GymDocumentTemplate" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'WAIVER',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GymDocumentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GymSignature" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerDocument" TEXT,
    "signatureUrl" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'RECEPTION',
    "ip" TEXT,
    "userAgent" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GymSignature_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GymDocumentTemplate_business_idx" ON "GymDocumentTemplate"("businessId");

CREATE INDEX IF NOT EXISTS "GymSignature_member_idx" ON "GymSignature"("memberId");

CREATE INDEX IF NOT EXISTS "GymSignature_template_member_idx" ON "GymSignature"("templateId", "memberId");

DO $$ BEGIN
  ALTER TABLE "GymDocumentTemplate" ADD CONSTRAINT "GymDocumentTemplate_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymSignature" ADD CONSTRAINT "GymSignature_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymSignature" ADD CONSTRAINT "GymSignature_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "GymDocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GymSignature" ADD CONSTRAINT "GymSignature_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GymMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
