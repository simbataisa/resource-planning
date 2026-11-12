-- Release 2 (N-01): retry schedule and last error for the email outbox.
ALTER TABLE "Notification" ADD COLUMN "nextAttemptAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN "lastError" VARCHAR(500);

CREATE INDEX "Notification_channel_status_nextAttemptAt_idx"
  ON "Notification"("channel", "status", "nextAttemptAt");
