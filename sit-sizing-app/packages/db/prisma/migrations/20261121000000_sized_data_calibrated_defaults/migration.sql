-- ADR-0019 fix-forward for 20261120000000_sized_data_assumptions (a merged migration is never
-- edited). That migration decided "uncalibrated" by value alone: a row still equal to the old
-- default took the new default triple. A row the team had calibrated to exactly that value,
-- with an entry for its path in "calibration", must keep its value at every size instead.
-- This puts those rows back to [old, old, old]. It only matches rows that hold the new default
-- triple and have a calibration entry, so running it twice changes nothing.
UPDATE "AssumptionProfile"
SET "values" = jsonb_set("values", '{dataDesign}', '[10, 10, 10]'::jsonb)
WHERE "calibration" ? 'dataDesign' AND "values"->'dataDesign' = '[10, 15, 25]'::jsonb;

UPDATE "AssumptionProfile"
SET "values" = jsonb_set("values", '{dataExec}', '[5, 5, 5]'::jsonb)
WHERE "calibration" ? 'dataExec' AND "values"->'dataExec' = '[5, 8, 12]'::jsonb;

UPDATE "AssumptionProfile"
SET "values" = jsonb_set("values", '{dataPrepHours}', '[2, 2, 2]'::jsonb)
WHERE "calibration" ? 'dataPrepHours' AND "values"->'dataPrepHours' = '[2, 3, 5]'::jsonb;
