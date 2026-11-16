-- ADR-0020: rough-scope features have ten sizes (XXS, XS, S, M-, M, M+, L, XL, XXL, XXXL).
-- Profiles have no schema version and are read with a cast, so the six new sizes are added to
-- each proxy group and to the performance scenarios here, at their defaults. Existing values
-- win ("defaults || existing"), so nothing that is already there changes and running this
-- twice changes nothing. Saved versions get the same through UPGRADES[2] on read.
UPDATE "AssumptionProfile"
SET "values" = jsonb_set("values", '{proxies}', '{"XXS": {"screen": 0, "field": 2, "api": 1, "integration": 0, "rule": 1, "journey": 0, "batch": 0, "event": 0, "workflow": 0, "actions": 0}, "XS": {"screen": 1, "field": 3, "api": 1, "integration": 0, "rule": 1, "journey": 1, "batch": 0, "event": 0, "workflow": 0, "actions": 1}, "M-": {"screen": 2, "field": 11, "api": 3, "integration": 1, "rule": 4, "journey": 1, "batch": 1, "event": 1, "workflow": 1, "actions": 2}, "M+": {"screen": 3, "field": 23, "api": 6, "integration": 2, "rule": 8, "journey": 2, "batch": 1, "event": 2, "workflow": 1, "actions": 3}, "XXL": {"screen": 13, "field": 99, "api": 25, "integration": 5, "rule": 32, "journey": 5, "batch": 4, "event": 7, "workflow": 4, "actions": 9}, "XXXL": {"screen": 23, "field": 178, "api": 45, "integration": 10, "rule": 58, "journey": 10, "batch": 6, "event": 13, "workflow": 6, "actions": 16}}'::jsonb || ("values"->'proxies'))
WHERE jsonb_typeof("values"->'proxies') = 'object';

UPDATE "AssumptionProfile"
SET "values" = jsonb_set("values", '{dproxies}', '{"XXS": {"feed": 0, "pipe": 0, "table": 1, "report": 0, "columns": 10, "dq": 2, "scd": 0, "secured": 0}, "XS": {"feed": 1, "pipe": 1, "table": 2, "report": 1, "columns": 20, "dq": 3, "scd": 0, "secured": 1}, "M-": {"feed": 2, "pipe": 2, "table": 6, "report": 2, "columns": 80, "dq": 13, "scd": 1, "secured": 2}, "M+": {"feed": 3, "pipe": 5, "table": 12, "report": 3, "columns": 190, "dq": 30, "scd": 2, "secured": 4}, "XXL": {"feed": 13, "pipe": 18, "table": 50, "report": 14, "columns": 864, "dq": 144, "scd": 9, "secured": 14}, "XXXL": {"feed": 23, "pipe": 32, "table": 91, "report": 26, "columns": 1555, "dq": 259, "scd": 16, "secured": 26}}'::jsonb || ("values"->'dproxies'))
WHERE jsonb_typeof("values"->'dproxies') = 'object';

UPDATE "AssumptionProfile"
SET "values" = jsonb_set("values", '{aproxies}', '{"XXS": {"intent": 1, "ocr": 0, "rag": 0, "tools": 0, "guard": 1, "hitl": 0}, "XS": {"intent": 2, "ocr": 0, "rag": 1, "tools": 1, "guard": 2, "hitl": 1}, "M-": {"intent": 6, "ocr": 1, "rag": 2, "tools": 2, "guard": 5, "hitl": 2}, "M+": {"intent": 12, "ocr": 2, "rag": 4, "tools": 4, "guard": 6, "hitl": 3}, "XXL": {"intent": 45, "ocr": 7, "rag": 14, "tools": 14, "guard": 14, "hitl": 7}, "XXXL": {"intent": 81, "ocr": 13, "rag": 26, "tools": 26, "guard": 26, "hitl": 13}}'::jsonb || ("values"->'aproxies'))
WHERE jsonb_typeof("values"->'aproxies') = 'object';

UPDATE "AssumptionProfile"
SET "values" = jsonb_set("values", '{ptRoughScen}', '{"XXS": 1, "XS": 1, "M-": 2, "M+": 3, "XXL": 8, "XXXL": 13}'::jsonb || ("values"->'ptRoughScen'))
WHERE jsonb_typeof("values"->'ptRoughScen') = 'object';

-- Saved versions keep their payload (upgraded on read), but their denormalised "uncalibrated"
-- column was counted out of 142 rows. The 18 new size rows are at their defaults once such a
-- version is upgraded, so they count as uncalibrated too. Otherwise the portfolio would show
-- an all-defaults version as partly calibrated (142 / 160). Unlike the statements above, this
-- one must run only once. Prisma applies each migration once, so never re-run it by hand.
UPDATE "EstimateVersion"
SET "uncalibrated" = "uncalibrated" + 18
WHERE "schemaVersion" < 3 AND "uncalibrated" <= 142;
