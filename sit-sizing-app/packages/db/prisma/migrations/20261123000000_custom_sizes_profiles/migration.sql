-- ADR-0021: feature sizes are profile data.
-- Every stored profile gains an ordered size list and empty size notes. The list is the
-- built-in names present in its proxies table, in built-in order (jsonb does not keep key
-- order). Values never change. Profiles that already have a list are left alone, so the
-- statement is safe to run twice.
UPDATE "AssumptionProfile" p
SET "values" = p."values" || jsonb_build_object(
  'sizes',
  COALESCE(
    (
      SELECT jsonb_agg(s.name ORDER BY s.ord)
      FROM (
        VALUES ('XXS', 1), ('XS', 2), ('S', 3), ('M-', 4), ('M', 5),
               ('M+', 6), ('L', 7), ('XL', 8), ('XXL', 9), ('XXXL', 10)
      ) AS s(name, ord)
      WHERE p."values"->'proxies' ? s.name
    ),
    '[]'::jsonb
  ),
  'sizeNotes',
  '{}'::jsonb
)
WHERE NOT (p."values" ? 'sizes');
