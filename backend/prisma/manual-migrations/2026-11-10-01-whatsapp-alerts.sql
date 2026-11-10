-- Notifications forwarded to the owner's WhatsApp (Configuración → Bot de WhatsApp → Avisos por WhatsApp).
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "whatsappAlerts" JSONB;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "whatsappAlertsSentAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "data" JSONB;
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");
