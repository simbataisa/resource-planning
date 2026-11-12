-- Release 3 (P-02): a note per recorded cycle, and one record per cycle label and version.
ALTER TABLE "Actuals" ADD COLUMN "note" VARCHAR(2000);

CREATE UNIQUE INDEX "Actuals_versionId_cycleLabel_key" ON "Actuals"("versionId", "cycleLabel");
