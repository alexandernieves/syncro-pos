-- Push notifications from Syncro central: campaigns, who got them, and the automations.
ALTER TABLE "PushSubscription" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

CREATE TABLE IF NOT EXISTS "PushCampaign" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "kind" TEXT NOT NULL DEFAULT 'MANUAL',
  "trigger" TEXT,
  "dedupeKey" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "url" TEXT,
  "audience" JSONB,
  "sentById" TEXT,
  "recipients" INTEGER NOT NULL DEFAULT 0,
  "reached" INTEGER NOT NULL DEFAULT 0,
  "devices" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "PushCampaign_dedupeKey_key" ON "PushCampaign"("dedupeKey");
CREATE INDEX IF NOT EXISTS "PushCampaign_kind_createdAt_idx" ON "PushCampaign"("kind", "createdAt");

CREATE TABLE IF NOT EXISTS "PushDelivery" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "campaignId" TEXT NOT NULL REFERENCES "PushCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "userId" TEXT NOT NULL,
  "businessId" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "PushDelivery_campaignId_userId_key" ON "PushDelivery"("campaignId", "userId");
CREATE INDEX IF NOT EXISTS "PushDelivery_userId_status_idx" ON "PushDelivery"("userId", "status");

CREATE TABLE IF NOT EXISTS "PushAutomation" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "url" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
