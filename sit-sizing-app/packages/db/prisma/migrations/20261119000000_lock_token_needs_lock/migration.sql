-- Draft lock token, defence in depth: a token hash only exists while someone holds the lock.
-- A trigger, not a CHECK: the previous app version clears the lock with only
-- "lockedById" and "lockExpiresAt" (it does not know "lockTokenHash"), and deleting a user
-- sets "lockedById" to NULL through the foreign key. A CHECK would refuse both; this trigger
-- clears the hash instead, so the migration stays expand-only (design 12.5) and rollback
-- or a rolling deploy keeps working. Like the init migration's triggers, Prisma does not
-- track it, so `prisma migrate diff` (pnpm db:check) reports no drift.
CREATE OR REPLACE FUNCTION "estimate_version_lock_token_needs_lock"() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF NEW."lockedById" IS NULL THEN
        NEW."lockTokenHash" := NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "EstimateVersion_lock_token_needs_lock" ON "EstimateVersion";
CREATE TRIGGER "EstimateVersion_lock_token_needs_lock"
    BEFORE INSERT OR UPDATE ON "EstimateVersion"
    FOR EACH ROW EXECUTE FUNCTION "estimate_version_lock_token_needs_lock"();
