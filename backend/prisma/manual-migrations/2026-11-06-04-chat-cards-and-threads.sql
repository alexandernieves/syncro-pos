-- Support chat: card messages (module offers, request updates) and messages tied to a module request
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "meta" JSONB;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "requestId" TEXT;
CREATE INDEX IF NOT EXISTS "Message_conversationId_isRead_idx" ON "Message"("conversationId", "isRead");
CREATE INDEX IF NOT EXISTS "Message_requestId_idx" ON "Message"("requestId");
