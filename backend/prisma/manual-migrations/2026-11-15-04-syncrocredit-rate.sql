-- Syncro Credit: which rate the clients' app uses to show what to transfer (usd = Bs at BCV dollar,
-- eur = Bs at BCV euro, cop = Colombian pesos). Additive only. Safe to run more than once.
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "syncroCreditRate" TEXT NOT NULL DEFAULT 'usd';
