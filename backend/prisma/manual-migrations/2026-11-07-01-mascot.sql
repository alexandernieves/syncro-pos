-- Syncro the mascot: per-user settings and its ideas (thoughts) with the replies.

CREATE TABLE IF NOT EXISTS "MascotProfile" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "settings"  JSONB NOT NULL DEFAULT '{}',
  "memory"    JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MascotProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MascotProfile_userId_key" ON "MascotProfile"("userId");

CREATE TABLE IF NOT EXISTS "MascotThought" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "text"       TEXT NOT NULL,
  "topic"      TEXT,
  "importance" INTEGER NOT NULL DEFAULT 1,
  "needsReply" BOOLEAN NOT NULL DEFAULT false,
  "emotion"    TEXT NOT NULL DEFAULT 'neutral',
  "status"     TEXT NOT NULL DEFAULT 'NEW',
  "messages"   JSONB NOT NULL DEFAULT '[]',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MascotThought_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MascotThought_userId_createdAt_idx" ON "MascotThought"("userId", "createdAt");
