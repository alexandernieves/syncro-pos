-- Photo of the bank receipt the member sends to the WhatsApp agent
ALTER TABLE "GymReportedPayment" ADD COLUMN IF NOT EXISTS "receiptUrl" TEXT;
