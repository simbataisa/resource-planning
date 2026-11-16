-- ADR-0021: each version stores its own assumption row total, 130 fixed rows plus 3 per
-- size. Versions saved so far all have the ten built-in sizes, so 160.
ALTER TABLE "EstimateVersion" ADD COLUMN "assumptionRows" INTEGER NOT NULL DEFAULT 160;
