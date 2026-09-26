-- Redesign (Arbeidslogg): a turområde is shown as a pin on the map instead of a polygon.
-- Hubs get an optional point location that admins can place, and the polygon becomes optional
-- so new areas can be created with just a pin. Hubs without a location fall back to a point
-- inside their polygon.

ALTER TABLE public.hubs ADD COLUMN location geometry(Point, 4326);
ALTER TABLE public.hubs ALTER COLUMN geom DROP NOT NULL;

-- New columns can only be appended, so `location` goes last
CREATE OR REPLACE VIEW public.all_features_geojson WITH (security_invoker = true) AS
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
  ST_AsGeoJSON(COALESCE(h.location, ST_PointOnSurface(h.geom)))::json AS location
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
  NULL::json AS location
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
  NULL::json AS location
FROM public.other_points p
LEFT JOIN public.hubs hb ON p.hub_id = hb.id;
