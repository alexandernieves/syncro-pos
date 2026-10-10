-- Invoice designer: template and customization chosen in Configuración → Factura.
-- Additive only. Safe to run more than once.
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "invoiceDesign" JSONB;
