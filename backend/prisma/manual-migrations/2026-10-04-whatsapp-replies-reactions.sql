-- WhatsApp chat: replies (quoted message) and reactions.
-- Additive only. Safe to run more than once.
ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "quotedMessageId" TEXT;
ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "quotedText" TEXT;
ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "quotedSenderType" TEXT;
ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "reaction" TEXT;
ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "contactReaction" TEXT;
