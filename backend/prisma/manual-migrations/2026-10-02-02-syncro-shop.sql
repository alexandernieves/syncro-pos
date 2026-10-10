-- Syncro Shop, phase 5: tax rate used to build each online order (prices include IVA).
-- Additive only. Safe to run more than once.
ALTER TABLE "ShopOrder" ADD COLUMN IF NOT EXISTS "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ShopOrder" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
