-- Draft lock token: only the SHA-256 of the token is stored; cleared with the lock.
ALTER TABLE "EstimateVersion" ADD COLUMN "lockTokenHash" TEXT;
