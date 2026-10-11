-- Gym charges become sales: SaleItem.description for non-product lines and GymPayment.saleId.
-- Additive only. Safe to run more than once.

ALTER TABLE "GymPayment" ADD COLUMN IF NOT EXISTS "saleId" TEXT;

ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "description" TEXT;
