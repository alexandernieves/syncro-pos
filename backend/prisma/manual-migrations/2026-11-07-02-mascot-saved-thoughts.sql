-- Syncro the mascot: ideas the user keeps in their history.
ALTER TABLE "MascotThought" ADD COLUMN IF NOT EXISTS "saved" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "MascotThought_userId_saved_idx" ON "MascotThought"("userId", "saved");
