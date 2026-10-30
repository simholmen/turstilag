-- Follow-up to 20261030120000_fase1_taxonomy_keys, run once the new frontend is out: the old keys
-- (tilrettelegging, rekkverk, steinsetting, drenering, underlag) are no longer accepted.
--
-- The renames run again first, in case an old browser saved something during the transition.

UPDATE public.other_points SET kind = 'stiforbedring' WHERE kind = 'tilrettelegging';

UPDATE public.other_points
SET subtype = CASE subtype
  WHEN 'rekkverk' THEN 'kjetting'
  WHEN 'steinsetting' THEN 'naturstein'
  WHEN 'drenering' THEN 'stikkror'
  WHEN 'underlag' THEN 'steinstov'
END
WHERE kind = 'stiforbedring' AND subtype IN ('rekkverk', 'steinsetting', 'drenering', 'underlag');

ALTER TABLE public.other_points DROP CONSTRAINT other_points_subtype_chk;
ALTER TABLE public.other_points ADD CONSTRAINT other_points_subtype_chk CHECK (
  subtype IS NULL
  OR (kind = 'stiforbedring' AND subtype IN ('bru', 'klopp', 'trapp', 'kjetting', 'naturstein', 'stikkror', 'grus', 'treflis', 'steinstov'))
  OR (kind = 'benk' AND subtype IN ('kvilebenk', 'bordbenk', 'enkel'))
  OR (kind = 'gjerdeklyver' AND subtype IN ('turstitrapp', 'turstiport', 'hundeluke', 'ombygd'))
);

ALTER TABLE public.other_points DROP CONSTRAINT other_points_geom_kind_chk;
ALTER TABLE public.other_points ADD CONSTRAINT other_points_geom_kind_chk CHECK (
  geometrytype(geom) = 'POINT'
  OR (kind IN ('stiforbedring', 'annet') AND geometrytype(geom) IN ('LINESTRING', 'POLYGON'))
);
