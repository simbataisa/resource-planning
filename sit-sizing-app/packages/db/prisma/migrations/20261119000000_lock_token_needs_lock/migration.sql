-- Draft lock token, defence in depth: a token hash only exists while someone holds the lock.
-- With "EstimateVersion_lock_only_drafts" this also keeps token hashes off saved versions.
-- Existing rows already satisfy it: every path that clears the lock clears the hash too.
ALTER TABLE "EstimateVersion" ADD CONSTRAINT "EstimateVersion_lock_token_needs_lock"
    CHECK ("lockTokenHash" IS NULL OR "lockedById" IS NOT NULL);
