-- Syncro Credit profile: the client's birth date. Additive only. Safe to run more than once.
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);
