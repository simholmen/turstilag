-- Remap existing other_points rows from the old flat worklog types onto the 7-kind taxonomy.
--
--   drenering / grus / nysti      -> tilrettelegging, subtype = old kind
--   merking / rydding             -> annet (recurring maintenance, not a physical object)
--   poi with icon = 'gjerdeklyver' -> gjerdeklyver (row stays in other_points)
--   anything else not in the 7    -> annet (poi, trail, …)
--   turinfo                       -> unchanged
--
-- The old kind is kept in legacy_kind, so the remap is reversible:
--   UPDATE public.other_points SET kind = legacy_kind, subtype = NULL, legacy_kind = NULL WHERE legacy_kind IS NOT NULL;
--
-- Every statement is guarded on legacy_kind IS NULL, so running this again changes nothing, and it is
-- a no-op on an empty table. gjerdeklyvere rows are left alone (subtype NULL = ukjent). No rows are
-- created for skilt, benk or parkering.

UPDATE public.other_points
SET legacy_kind = kind, subtype = kind, kind = 'tilrettelegging'
WHERE kind IN ('drenering', 'grus', 'nysti') AND legacy_kind IS NULL;

UPDATE public.other_points
SET legacy_kind = kind, kind = 'annet'
WHERE kind IN ('merking', 'rydding') AND legacy_kind IS NULL;

-- Must run before the catch-all below, or these would be swept into annet
UPDATE public.other_points
SET legacy_kind = kind, kind = 'gjerdeklyver'
WHERE icon = 'gjerdeklyver' AND kind IS DISTINCT FROM 'gjerdeklyver' AND legacy_kind IS NULL;

UPDATE public.other_points
SET legacy_kind = kind, kind = 'annet'
WHERE (kind IS NULL OR kind NOT IN ('gjerdeklyver', 'skilt', 'tilrettelegging', 'turinfo', 'benk', 'parkering', 'annet'))
  AND legacy_kind IS NULL;
