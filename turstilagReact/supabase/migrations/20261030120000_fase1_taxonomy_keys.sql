-- Fase 1 of the feedback round: renamed keys, new subtypes and the stikryss kind.
--
--   kind tilrettelegging -> stiforbedring
--   subtype rekkverk -> kjetting, steinsetting -> naturstein, drenering -> stikkror, underlag -> steinstov
--   benk gets subtypes kvilebenk, bordbenk, enkel (existing benker stay NULL = ukjent)
--   gjerdeklyver gets subtype ombygd; rows that 20260929130000 turned into annen/'Ombygd klyver' move back
--   new point kind stikryss (other_points.kind has no CHECK, and point geometry is always allowed)
--
-- This is the transitional step: the constraints accept both the old and the new keys, so a browser
-- still running the old frontend can save until it reloads. Once the new frontend is out, a follow-up
-- migration re-runs the renames below and drops the old keys from the constraints.
--
-- legacy_kind is left alone — it records where a row came from, not what it is now. Every UPDATE is
-- guarded on the old value, so running this again changes nothing. The views pass kind/subtype
-- straight through, so none of them need rebuilding.

ALTER TABLE public.other_points DROP CONSTRAINT other_points_subtype_chk;
ALTER TABLE public.other_points DROP CONSTRAINT other_points_geom_kind_chk;
ALTER TABLE public.gjerdeklyvere DROP CONSTRAINT gjerdeklyvere_subtypes_chk;

-- ── Other points ──────────────────────────────────────────────────────────────────────────────────
UPDATE public.other_points SET kind = 'stiforbedring' WHERE kind = 'tilrettelegging';

UPDATE public.other_points
SET subtype = CASE subtype
  WHEN 'rekkverk' THEN 'kjetting'
  WHEN 'steinsetting' THEN 'naturstein'
  WHEN 'drenering' THEN 'stikkror'
  WHEN 'underlag' THEN 'steinstov'
END
WHERE kind = 'stiforbedring' AND subtype IN ('rekkverk', 'steinsetting', 'drenering', 'underlag');

-- The tilrettelegging line is the transitional one
ALTER TABLE public.other_points ADD CONSTRAINT other_points_subtype_chk CHECK (
  subtype IS NULL
  OR (kind = 'stiforbedring' AND subtype IN ('bru', 'klopp', 'trapp', 'kjetting', 'naturstein', 'stikkror', 'grus', 'treflis', 'steinstov'))
  OR (kind = 'tilrettelegging' AND subtype IN ('bru', 'klopp', 'trapp', 'rekkverk', 'steinsetting', 'drenering', 'grus', 'treflis', 'underlag'))
  OR (kind = 'benk' AND subtype IN ('kvilebenk', 'bordbenk', 'enkel'))
  OR (kind = 'gjerdeklyver' AND subtype IN ('turstitrapp', 'turstiport', 'hundeluke', 'ombygd'))
);

ALTER TABLE public.other_points ADD CONSTRAINT other_points_geom_kind_chk CHECK (
  geometrytype(geom) = 'POINT'
  OR (kind IN ('stiforbedring', 'tilrettelegging', 'annet') AND geometrytype(geom) IN ('LINESTRING', 'POLYGON'))
);

-- ── Gjerdeklyvere ─────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.gjerdeklyvere ADD CONSTRAINT gjerdeklyvere_subtypes_chk
  CHECK (subtypes <@ ARRAY['turstitrapp', 'turstiport', 'hundeluke', 'ombygd', 'annen']::text[]);

-- subtype_other is cleared in the same statement, which keeps gjerdeklyvere_subtype_other_chk happy
UPDATE public.gjerdeklyvere
SET subtypes = array_replace(subtypes, 'annen', 'ombygd'), subtype_other = NULL
WHERE 'annen' = ANY (subtypes) AND subtype_other = 'Ombygd klyver';
