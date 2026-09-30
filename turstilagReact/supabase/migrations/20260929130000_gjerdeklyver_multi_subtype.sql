-- Kryssningspunkt (gjerdeklyver) subtypes become a multi-select: a crossing can be both a
-- turstitrapp and have a hundeluke. The set is now turstitrapp, turstiport, hundeluke and annen;
-- "annen" carries a typed-out name in subtype_other (its description is required by the UI).
--
-- Old single values are remapped: standard -> no subtype (the plain klyver is the baseline),
-- ombygd -> annen named 'Ombygd klyver'. Legacy gjerdeklyvere in other_points keep a single subtype
-- column there — editing one moves it into gjerdeklyvere — so only its allowed values narrow.
--
-- The views now expose `subtypes text[]` (plus subtype_other) for every kind instead of `subtype`;
-- other_points' single subtype comes through as a one-element array. A column type change can't be
-- done with CREATE OR REPLACE, and the old column is dropped, so both views are rebuilt.

DROP VIEW IF EXISTS public.all_features_geojson;
DROP VIEW IF EXISTS public.route_features;

-- ── Gjerdeklyvere ─────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.gjerdeklyvere
  ADD COLUMN subtypes text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN subtype_other text;

UPDATE public.gjerdeklyvere SET subtypes = ARRAY[subtype] WHERE subtype IN ('hundeluke', 'turstiport', 'turstitrapp');
UPDATE public.gjerdeklyvere SET subtypes = ARRAY['annen'], subtype_other = 'Ombygd klyver' WHERE subtype = 'ombygd';

ALTER TABLE public.gjerdeklyvere DROP COLUMN subtype;

ALTER TABLE public.gjerdeklyvere ADD CONSTRAINT gjerdeklyvere_subtypes_chk
  CHECK (subtypes <@ ARRAY['turstitrapp', 'turstiport', 'hundeluke', 'annen']::text[]);
-- The name is there exactly when "annen" is chosen
ALTER TABLE public.gjerdeklyvere ADD CONSTRAINT gjerdeklyvere_subtype_other_chk CHECK (
  CASE WHEN 'annen' = ANY (subtypes)
    THEN NULLIF(btrim(subtype_other), '') IS NOT NULL
    ELSE subtype_other IS NULL
  END
);

-- ── Legacy gjerdeklyvere in other_points ─────────────────────────────────────────────────────────
UPDATE public.other_points SET subtype = NULL WHERE kind = 'gjerdeklyver' AND subtype IN ('standard', 'ombygd');

ALTER TABLE public.other_points DROP CONSTRAINT other_points_subtype_chk;
ALTER TABLE public.other_points ADD CONSTRAINT other_points_subtype_chk CHECK (
  subtype IS NULL
  OR (kind = 'tilrettelegging' AND subtype IN ('bru', 'klopp', 'trapp', 'rekkverk', 'steinsetting', 'drenering', 'grus', 'nysti'))
  OR (kind = 'gjerdeklyver' AND subtype IN ('turstitrapp', 'turstiport', 'hundeluke'))
);

-- ── Views (as in 20260929120000_taxonomy_and_routes, with subtype -> subtypes, subtype_other) ─────
CREATE VIEW public.all_features_geojson WITH (security_invoker = true) AS
SELECT
  h.id::text AS id,
  h.name AS slug,
  h.title,
  'hub' AS kind,
  NULL::text AS feature_group,
  NULL::text AS icon,
  h.popup,
  h.description,
  h.includes,
  h.difficulty,
  COALESCE(TO_CHAR(h.last_updated,'YYYY-MM-DD'), NULL) AS last_updated,
  h.images,
  h.created_at,
  h.updated_at,
  h.color,
  ST_AsGeoJSON(h.geom)::json AS geometry,
  ST_AsGeoJSON(COALESCE(h.location, ST_PointOnSurface(h.geom)))::json AS location,
  '{}'::text[] AS subtypes,
  NULL::text AS subtype_other,
  NULL::text AS hund,
  NULL::text AS plasser,
  NULL::text AS legacy_kind,
  'hubs'::text AS source_table,
  geometrytype(h.geom) AS geom_type,
  ST_AsGeoJSON(COALESCE(h.location, ST_PointOnSurface(h.geom)))::json AS anchor,
  0::double precision AS length_m,
  COALESCE(ST_Area(h.geom::geography), 0) AS area_m2
FROM public.hubs h
UNION ALL
SELECT
  g.id::text AS id,
  NULL::text AS slug,
  g.title,
  'gjerdeklyver' AS kind,
  hb.name AS feature_group,
  g.icon,
  g.popup,
  g.description,
  g.includes,
  g.difficulty,
  COALESCE(TO_CHAR(g.last_updated,'YYYY-MM-DD'), NULL) AS last_updated,
  g.images,
  g.created_at,
  g.updated_at,
  g.color,
  ST_AsGeoJSON(g.geom)::json AS geometry,
  NULL::json AS location,
  g.subtypes,
  g.subtype_other,
  g.hund,
  NULL::text AS plasser,
  NULL::text AS legacy_kind,
  'gjerdeklyvere'::text AS source_table,
  geometrytype(g.geom) AS geom_type,
  ST_AsGeoJSON(g.geom)::json AS anchor,
  0::double precision AS length_m,
  0::double precision AS area_m2
FROM public.gjerdeklyvere g
LEFT JOIN public.hubs hb ON g.hub_id = hb.id
UNION ALL
SELECT
  p.id::text AS id,
  NULL::text AS slug,
  p.title,
  p.kind AS kind,
  hb.name AS feature_group,
  p.icon,
  p.popup,
  p.description,
  p.includes,
  p.difficulty,
  COALESCE(TO_CHAR(p.last_updated,'YYYY-MM-DD'), NULL) AS last_updated,
  p.images,
  p.created_at,
  p.updated_at,
  p.color,
  ST_AsGeoJSON(p.geom)::json AS geometry,
  NULL::json AS location,
  CASE WHEN p.subtype IS NULL THEN '{}'::text[] ELSE ARRAY[p.subtype] END AS subtypes,
  NULL::text AS subtype_other,
  NULL::text AS hund,
  p.plasser,
  p.legacy_kind,
  'other_points'::text AS source_table,
  geometrytype(p.geom) AS geom_type,
  ST_AsGeoJSON(public.feature_anchor(p.geom))::json AS anchor,
  ST_Length(p.geom::geography) AS length_m,
  ST_Area(p.geom::geography) AS area_m2
FROM public.other_points p
LEFT JOIN public.hubs hb ON p.hub_id = hb.id;

CREATE VIEW public.route_features WITH (security_invoker = true) AS
WITH features AS (
  SELECT 'gjerdeklyvere'::text AS feature_table, g.id, 'gjerdeklyver'::text AS kind, g.subtypes, g.subtype_other, g.title, g.geom
  FROM public.gjerdeklyvere g
  UNION ALL
  SELECT 'other_points'::text, p.id, p.kind,
    CASE WHEN p.subtype IS NULL THEN '{}'::text[] ELSE ARRAY[p.subtype] END, NULL::text, p.title, p.geom
  FROM public.other_points p
),
located AS (
  SELECT
    r.id AS route_id,
    f.feature_table,
    f.id AS feature_id,
    f.kind,
    f.subtypes,
    f.subtype_other,
    f.title,
    geometrytype(f.geom) AS geom_type,
    ST_Length(r.geom::geography) / 1000 AS route_km,
    ST_LineLocatePoint(r.geom, public.feature_anchor(f.geom)) AS pos,
    CASE WHEN geometrytype(f.geom) = 'LINESTRING' THEN ST_LineLocatePoint(r.geom, ST_StartPoint(f.geom)) END AS pos_start,
    CASE WHEN geometrytype(f.geom) = 'LINESTRING' THEN ST_LineLocatePoint(r.geom, ST_EndPoint(f.geom)) END AS pos_end,
    ST_Length(f.geom::geography) AS length_m
  FROM public.routes r
  JOIN features f ON ST_DWithin(r.geom::geography, f.geom::geography, 15)
)
SELECT
  route_id::text AS route_id,
  feature_table,
  feature_id::text AS feature_id,
  kind,
  subtypes,
  subtype_other,
  title,
  geom_type,
  pos * route_km AS km,
  LEAST(pos_start, pos_end) * route_km AS km_fra,
  GREATEST(pos_start, pos_end) * route_km AS km_til,
  length_m
FROM located;
