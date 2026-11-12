-- Init migration for the `app` database (design 5.2.1).
-- Part 1 mirrors prisma/schema.prisma. Part 2 adds constraints Prisma cannot model.
-- After the first install run `pnpm --filter @sit/db check`: it must report no difference
-- between this migration history and schema.prisma. Merged migrations are never edited.

-- ===================== Part 1: schema.prisma =====================

-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('VIEWER', 'ESTIMATOR', 'QE_LEAD');

-- CreateEnum
CREATE TYPE "VersionStatus" AS ENUM ('DRAFT', 'SAVED', 'SUBMITTED', 'APPROVED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ProfileScope" AS ENUM ('GLOBAL', 'PROJECT');

-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "CommentKind" AS ENUM ('COMMENT', 'RETURN', 'APPROVE');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('SUBMITTED', 'APPROVED', 'RETURNED', 'PROFILE_PUBLISHED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "globalRole" "GlobalRole" NOT NULL DEFAULT 'USER',
    "locale" VARCHAR(5) NOT NULL DEFAULT 'en',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(16) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(2000),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL,
    "addedById" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateTable
CREATE TABLE "Estimate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(2000),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateVersion" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "VersionStatus" NOT NULL DEFAULT 'DRAFT',
    "inputs" JSONB NOT NULL,
    "profileId" TEXT,
    "assumptions" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "engineVersion" VARCHAR(20) NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "roughFte" DECIMAL(8,2) NOT NULL,
    "detailedFte" DECIMAL(8,2) NOT NULL,
    "totalCasesDetailed" INTEGER NOT NULL,
    "uncalibrated" INTEGER NOT NULL,
    "note" VARCHAR(2000),
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "lockedById" TEXT,
    "lockExpiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "EstimateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssumptionProfile" (
    "id" TEXT NOT NULL,
    "scope" "ProfileScope" NOT NULL,
    "projectId" TEXT,
    "name" VARCHAR(120) NOT NULL,
    "status" "ProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "values" JSONB NOT NULL,
    "calibration" JSONB NOT NULL DEFAULT '{}',
    "basedOnId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "AssumptionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Actuals" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "cycleLabel" VARCHAR(80) NOT NULL,
    "data" JSONB NOT NULL,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Actuals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewComment" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" "CommentKind" NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "versionId" TEXT,
    "kind" "NotificationKind" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "entity" VARCHAR(40) NOT NULL,
    "entityId" TEXT NOT NULL,
    "projectId" TEXT,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "requestId" VARCHAR(128),
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_subject_key" ON "User"("subject");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_key_key" ON "Project"("key");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE INDEX "Estimate_projectId_createdAt_idx" ON "Estimate"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "EstimateVersion_estimateId_status_idx" ON "EstimateVersion"("estimateId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EstimateVersion_estimateId_number_key" ON "EstimateVersion"("estimateId", "number");

-- CreateIndex
CREATE INDEX "AssumptionProfile_projectId_status_idx" ON "AssumptionProfile"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AssumptionProfile_scope_projectId_name_key" ON "AssumptionProfile"("scope", "projectId", "name");

-- CreateIndex
CREATE INDEX "Actuals_versionId_idx" ON "Actuals"("versionId");

-- CreateIndex
CREATE INDEX "ReviewComment_versionId_createdAt_idx" ON "ReviewComment"("versionId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_idx" ON "Notification"("recipientId", "readAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entity_entityId_idx" ON "AuditEvent"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_projectId_at_idx" ON "AuditEvent"("projectId", "at");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateVersion" ADD CONSTRAINT "EstimateVersion_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateVersion" ADD CONSTRAINT "EstimateVersion_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AssumptionProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateVersion" ADD CONSTRAINT "EstimateVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateVersion" ADD CONSTRAINT "EstimateVersion_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateVersion" ADD CONSTRAINT "EstimateVersion_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssumptionProfile" ADD CONSTRAINT "AssumptionProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssumptionProfile" ADD CONSTRAINT "AssumptionProfile_basedOnId_fkey" FOREIGN KEY ("basedOnId") REFERENCES "AssumptionProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssumptionProfile" ADD CONSTRAINT "AssumptionProfile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actuals" ADD CONSTRAINT "Actuals_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "EstimateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actuals" ADD CONSTRAINT "Actuals_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "EstimateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "EstimateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===================== Part 2: constraints Prisma cannot model =====================

-- Rules below use triggers and CHECK constraints, which Prisma does not track, so
-- `prisma migrate diff` (pnpm db:check) does not report them as drift. A partial
-- unique index would be reported as an index to drop.

-- One editable draft per estimate (design 5.2.1). The advisory lock serialises
-- concurrent writers for the same estimate, so two drafts cannot slip in together.
CREATE FUNCTION "estimate_version_one_draft"() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF NEW."status" = 'DRAFT' THEN
        PERFORM pg_advisory_xact_lock(hashtext('draft:' || NEW."estimateId"));
        IF EXISTS (
            SELECT 1 FROM "EstimateVersion"
            WHERE "estimateId" = NEW."estimateId" AND "status" = 'DRAFT' AND "id" <> NEW."id"
        ) THEN
            RAISE EXCEPTION 'Estimate % already has a draft', NEW."estimateId" USING ERRCODE = 'unique_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "EstimateVersion_one_draft"
    BEFORE INSERT OR UPDATE OF "status", "estimateId" ON "EstimateVersion"
    FOR EACH ROW EXECUTE FUNCTION "estimate_version_one_draft"();

-- Only drafts carry an edit lock.
ALTER TABLE "EstimateVersion" ADD CONSTRAINT "EstimateVersion_lock_only_drafts"
    CHECK (("lockedById" IS NULL AND "lockExpiresAt" IS NULL) OR "status" = 'DRAFT');

-- Profile scope: PROJECT needs a project, GLOBAL must not have one.
ALTER TABLE "AssumptionProfile" ADD CONSTRAINT "AssumptionProfile_scope_project_check"
    CHECK (("scope" = 'PROJECT' AND "projectId" IS NOT NULL) OR ("scope" = 'GLOBAL' AND "projectId" IS NULL));

-- Global profile names are unique too (NULL project ids are distinct in the regular unique index).
CREATE FUNCTION "assumption_profile_global_name"() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF NEW."scope" = 'GLOBAL' THEN
        PERFORM pg_advisory_xact_lock(hashtext('profile:' || NEW."name"));
        IF EXISTS (
            SELECT 1 FROM "AssumptionProfile"
            WHERE "scope" = 'GLOBAL' AND "name" = NEW."name" AND "id" <> NEW."id"
        ) THEN
            RAISE EXCEPTION 'A global profile named % already exists', NEW."name" USING ERRCODE = 'unique_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "AssumptionProfile_global_name"
    BEFORE INSERT OR UPDATE OF "scope", "name" ON "AssumptionProfile"
    FOR EACH ROW EXECUTE FUNCTION "assumption_profile_global_name"();

-- Audit events are append-only, whatever role connects (design 5.2.1, threat model T-05).
CREATE FUNCTION "audit_event_append_only"() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'AuditEvent is append-only (% blocked)', TG_OP USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "AuditEvent_no_update_delete"
    BEFORE UPDATE OR DELETE ON "AuditEvent"
    FOR EACH ROW EXECUTE FUNCTION "audit_event_append_only"();

CREATE TRIGGER "AuditEvent_no_truncate"
    BEFORE TRUNCATE ON "AuditEvent"
    FOR EACH STATEMENT EXECUTE FUNCTION "audit_event_append_only"();
