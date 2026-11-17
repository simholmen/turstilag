-- Warning of overlapping stretches in a turrute variant. A stretch that overlaps another in a variant is
-- left out of it by route_variant_compose; ticking such a pair is refused, but redrawing a stretch, or
-- the route itself, can still bring two together.
--
-- route_variants_geojson gets `skipped`: how many of the variant's stretches are left out that way, so
-- the admin can see which variants need fixing.
CREATE OR REPLACE VIEW public.route_variants_geojson WITH (security_invoker = true) AS
SELECT
  v.id::text AS id,
  v.route_id::text AS route_id,
  v.name,
  v.difficulty,
  v.climb,
  v.description,
  v.sort_order,
  ST_Length(c.line::geography) / 1000 AS km,
  ST_AsGeoJSON(c.line)::json AS geometry,
  ARRAY(
    SELECT va.alternative_id::text FROM public.route_variant_alternatives va
    WHERE va.variant_id = v.id ORDER BY va.alternative_id
  ) AS alternative_ids,
  c.skipped
FROM public.route_variants v
JOIN public.routes r ON r.id = v.route_id
CROSS JOIN LATERAL public.route_variant_compose(r.geom, ARRAY(
  SELECT a.geom FROM public.route_variant_alternatives va
  JOIN public.route_alternatives a ON a.id = va.alternative_id
  WHERE va.variant_id = v.id
)) c;

-- The variants a stretch would overlap in if it were redrawn as `line_geojson`, checked before saving
CREATE OR REPLACE FUNCTION public.route_alternative_conflicts(alternative_id bigint, line_geojson json)
RETURNS TABLE (id text, variant_name text)
LANGUAGE sql
STABLE
AS $$
  SELECT v.id::text, v.name
  FROM public.route_alternatives alt
  JOIN public.routes r ON r.id = alt.route_id
  JOIN public.route_variant_alternatives used ON used.alternative_id = alt.id
  JOIN public.route_variants v ON v.id = used.variant_id
  CROSS JOIN LATERAL public.route_variant_compose(r.geom, ARRAY(
    SELECT CASE WHEN a.id = alt.id THEN ST_SetSRID(ST_GeomFromGeoJSON(line_geojson::text), 4326) ELSE a.geom END
    FROM public.route_variant_alternatives va
    JOIN public.route_alternatives a ON a.id = va.alternative_id
    WHERE va.variant_id = v.id
  )) c
  WHERE alt.id = route_alternative_conflicts.alternative_id AND c.skipped > 0
  ORDER BY v.sort_order, v.name
$$;
