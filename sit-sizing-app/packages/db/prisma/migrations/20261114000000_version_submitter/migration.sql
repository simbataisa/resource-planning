-- Release 2 (V-01): who submitted a version, for segregation of duties on approval.
ALTER TABLE "EstimateVersion" ADD COLUMN "submittedById" TEXT;

ALTER TABLE "EstimateVersion"
  ADD CONSTRAINT "EstimateVersion_submittedById_fkey"
  FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
