-- Syncro Credit "Para ti": product ads chosen from Syncro Central (products from each business's
-- own catalog). Additive only. Safe to run more than once.
CREATE TABLE IF NOT EXISTS "SyncroCreditAd" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "headline" TEXT,
  "theme" TEXT NOT NULL DEFAULT 'sunset',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncroCreditAd_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SyncroCreditAd_active_sortOrder_idx" ON "SyncroCreditAd"("active", "sortOrder");
DO $$ BEGIN
  ALTER TABLE "SyncroCreditAd" ADD CONSTRAINT "SyncroCreditAd_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SyncroCreditAd" ADD CONSTRAINT "SyncroCreditAd_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
