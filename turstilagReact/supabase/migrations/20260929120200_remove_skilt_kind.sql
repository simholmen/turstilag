-- Drop "skilt" from the point taxonomy: it duplicated turinfo (both were signage), so the UI no
-- longer offers it. No rows use kind = 'skilt' — the taxonomy migration and its backfill never
-- created any — so this is a pure constraint narrowing, no data to remap.

ALTER TABLE public.other_points DROP CONSTRAINT other_points_subtype_chk;
ALTER TABLE public.other_points ADD CONSTRAINT other_points_subtype_chk CHECK (
  subtype IS NULL
  OR (kind = 'tilrettelegging' AND subtype IN ('bru', 'klopp', 'trapp', 'rekkverk', 'steinsetting', 'drenering', 'grus', 'nysti'))
  OR (kind = 'gjerdeklyver' AND subtype IN ('standard', 'hundeluke', 'turstiport', 'turstitrapp', 'ombygd'))
);
