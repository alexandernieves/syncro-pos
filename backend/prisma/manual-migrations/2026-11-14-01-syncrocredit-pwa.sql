-- Syncro Credit (PWA) settings per business: whether the business shows up in the clients' app,
-- and its own card in "Para ti". Additive only. Safe to run more than once.
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "syncroCreditVisible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "syncroCreditPromoTitle" TEXT;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "syncroCreditPromoText" TEXT;
