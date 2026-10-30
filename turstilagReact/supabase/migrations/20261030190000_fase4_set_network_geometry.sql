-- Fase 4: editing a stinettverk's lines by dragging their vertices. The frontend sends the whole edited
-- geometry back; this re-joins it like add_trail_to_network does. Every part end that was dragged onto
-- another line first gets a vertex there (ST_Snap to the ends), so the union nodes the two into a junction.

CREATE FUNCTION public.set_network_geometry(network_id bigint, lines_geojson json)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  lines geometry := ST_SetSRID(ST_GeomFromGeoJSON(lines_geojson::text), 4326);
  ends geometry;
BEGIN
  SELECT ST_Collect(p) INTO ends FROM (
    SELECT ST_StartPoint(d.geom) AS p FROM ST_Dump(lines) d
    UNION ALL
    SELECT ST_EndPoint(d.geom) FROM ST_Dump(lines) d
  ) e;
  IF ends IS NOT NULL THEN
    lines := ST_Snap(lines, ends, 1e-7);
  END IF;

  UPDATE public.trail_networks SET geom = public.network_merge(lines) WHERE id = network_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stinettverk % finnes ikke', network_id;
  END IF;
END
$$;
