-- Syncro Credit ads: the ad's own photo (e.g. the product with its background removed). The
-- business's catalog photo is never touched. Additive only. Safe to run more than once.
ALTER TABLE "SyncroCreditAd" ADD COLUMN IF NOT EXISTS "image" TEXT;
