-- Sign in with fingerprint (Touch ID) or Windows Hello from a saved profile.
CREATE TABLE IF NOT EXISTS "BiometricCredential" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "kind" TEXT NOT NULL,
  "deviceName" TEXT NOT NULL,
  "platform" TEXT,
  "secretHash" TEXT,
  "credentialId" TEXT,
  "publicKey" TEXT,
  "counter" INTEGER NOT NULL DEFAULT 0,
  "transports" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "BiometricCredential_credentialId_key" ON "BiometricCredential"("credentialId");
CREATE INDEX IF NOT EXISTS "BiometricCredential_userId_idx" ON "BiometricCredential"("userId");
