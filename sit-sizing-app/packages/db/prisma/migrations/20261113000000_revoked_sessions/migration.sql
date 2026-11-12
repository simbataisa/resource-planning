-- Step 1.7: back-channel logout (design 10.4, threat model T-01).
-- Keycloak session ids whose app sessions must end immediately.
CREATE TABLE "RevokedSession" (
    "sid" VARCHAR(128) NOT NULL,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevokedSession_pkey" PRIMARY KEY ("sid")
);

CREATE INDEX "RevokedSession_expiresAt_idx" ON "RevokedSession"("expiresAt");
