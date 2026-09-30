-- Tilrettelegging subtypes: "Grus / underlag" splits into grus, treflis and underlag, and "Ny sti"
-- is dropped. Existing grus rows stay grus; nysti rows keep their entry but lose the subtype
-- (legacy_kind still records where backfilled ones came from).

UPDATE public.other_points SET subtype = NULL WHERE kind = 'tilrettelegging' AND subtype = 'nysti';

ALTER TABLE public.other_points DROP CONSTRAINT other_points_subtype_chk;
ALTER TABLE public.other_points ADD CONSTRAINT other_points_subtype_chk CHECK (
  subtype IS NULL
  OR (kind = 'tilrettelegging' AND subtype IN ('bru', 'klopp', 'trapp', 'rekkverk', 'steinsetting', 'drenering', 'grus', 'treflis', 'underlag'))
  OR (kind = 'gjerdeklyver' AND subtype IN ('turstitrapp', 'turstiport', 'hundeluke'))
);
