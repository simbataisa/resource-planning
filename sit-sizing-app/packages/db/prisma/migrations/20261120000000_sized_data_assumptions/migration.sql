-- ADR-0019: data-test design minutes, execution minutes and preparation hours become
-- Simple/Medium/Complex triples. Profiles have no schema version and are read with a cast,
-- so their stored values are rewritten here (saved versions are upgraded on read instead).
--   * a value still equal to the old default (uncalibrated) takes the new default triple,
--     so it stays uncalibrated;
--   * any other (calibrated) value v becomes [v, v, v], so it keeps its numbers.
-- Only keys that still hold a number are touched, so running this twice changes nothing.
-- Rollback SQL for an older release is in docs/runbook.md ("Profile data migration, ADR-0019").
UPDATE "AssumptionProfile"
SET "values" = jsonb_set("values", '{dataDesign}',
    CASE WHEN ("values"->>'dataDesign')::numeric = 10 THEN '[10, 15, 25]'::jsonb
         ELSE jsonb_build_array("values"->'dataDesign', "values"->'dataDesign', "values"->'dataDesign') END)
WHERE jsonb_typeof("values"->'dataDesign') = 'number';

UPDATE "AssumptionProfile"
SET "values" = jsonb_set("values", '{dataExec}',
    CASE WHEN ("values"->>'dataExec')::numeric = 5 THEN '[5, 8, 12]'::jsonb
         ELSE jsonb_build_array("values"->'dataExec', "values"->'dataExec', "values"->'dataExec') END)
WHERE jsonb_typeof("values"->'dataExec') = 'number';

UPDATE "AssumptionProfile"
SET "values" = jsonb_set("values", '{dataPrepHours}',
    CASE WHEN ("values"->>'dataPrepHours')::numeric = 2 THEN '[2, 3, 5]'::jsonb
         ELSE jsonb_build_array("values"->'dataPrepHours', "values"->'dataPrepHours', "values"->'dataPrepHours') END)
WHERE jsonb_typeof("values"->'dataPrepHours') = 'number';
