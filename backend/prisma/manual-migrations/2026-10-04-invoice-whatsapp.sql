-- Invoice sent by WhatsApp after a sale: last attempt, recipient and error.
-- Additive only. Safe to run more than once.
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "whatsappInvoiceStatus" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "whatsappInvoiceTo" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "whatsappInvoiceSentAt" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "whatsappInvoiceError" TEXT;
