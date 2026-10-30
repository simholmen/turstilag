-- Fase 4: better overlap handling for stinettverk, shared by "Legg til sti" and dragging the lines.
--
-- Before, everything of a new path within 8 m of the network was cut away. That also cut the first
-- metres of a path branching off at a sharp angle, and dragging a line onto another one in the editor
-- left two lines side by side (set_network_geometry only dissolved exact overlap_lines).
--
-- Now a stretch is only treated as overlap when it runs along the network for at least 25 m; a path
-- that just starts at, crosses or comes close to the network keeps its own shape. Overlapping stretches
-- are removed and the ends left behind are tied onto the network. A path whose own start or end stops
-- within 8 m of the network is extended onto it.

CREATE FUNCTION public.network_with_line(net geometry, line geometry)
RETURNS geometry
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  tol constant double precision := 8;           -- metres
  min_overlap constant double precision := 25;  -- metres along the network before it counts as overlap
  overlap_lines geometry;
  pieces geometry[] := '{}';
  piece geometry;
  ends geometry;
BEGIN
  IF net IS NULL OR ST_IsEmpty(net) THEN
    RETURN public.network_merge(line);
  END IF;

  -- A loose start or end close to the network is joined to it
  IF ST_DWithin(ST_StartPoint(line)::geography, net::geography, tol)
    AND NOT ST_DWithin(ST_StartPoint(line)::geography, net::geography, 0.01) THEN
    line := ST_AddPoint(line, ST_ClosestPoint(net, ST_StartPoint(line)), 0);
  END IF;
  IF ST_DWithin(ST_EndPoint(line)::geography, net::geography, tol)
    AND NOT ST_DWithin(ST_EndPoint(line)::geography, net::geography, 0.01) THEN
    line := ST_AddPoint(line, ST_ClosestPoint(net, ST_EndPoint(line)));
  END IF;

  SELECT ST_Collect(d.geom) INTO overlap_lines
  FROM ST_Dump(ST_Intersection(line, ST_Buffer(net::geography, tol)::geometry)) d
  WHERE geometrytype(d.geom) = 'LINESTRING' AND ST_Length(d.geom::geography) >= min_overlap;

  IF overlap_lines IS NULL THEN
    pieces := ARRAY[line];
  ELSE
    FOR piece IN
      SELECT (ST_Dump(ST_Difference(line, ST_Buffer(overlap_lines::geography, 0.5)::geometry))).geom
    LOOP
      IF geometrytype(piece) <> 'LINESTRING' THEN CONTINUE; END IF;
      -- Ends left where an overlap was cut away are tied onto the network
      IF ST_DWithin(ST_StartPoint(piece)::geography, overlap_lines::geography, 1)
        AND ST_DWithin(ST_StartPoint(piece)::geography, net::geography, tol + 1) THEN
        piece := ST_AddPoint(piece, ST_ClosestPoint(net, ST_StartPoint(piece)), 0);
      END IF;
      IF ST_DWithin(ST_EndPoint(piece)::geography, overlap_lines::geography, 1)
        AND ST_DWithin(ST_EndPoint(piece)::geography, net::geography, tol + 1) THEN
        piece := ST_AddPoint(piece, ST_ClosestPoint(net, ST_EndPoint(piece)));
      END IF;
      pieces := pieces || piece;
    END LOOP;
  END IF;

  IF array_length(pieces, 1) IS NULL THEN
    RETURN public.network_merge(net);
  END IF;

  -- Give the network a vertex exactly where each piece meets it, so the union nodes them together
  SELECT ST_Collect(p) INTO ends FROM (
    SELECT ST_StartPoint(x) AS p FROM unnest(pieces) x
    UNION ALL
    SELECT ST_EndPoint(x) FROM unnest(pieces) x
  ) e;
  net := ST_Snap(net, ends, 1e-7);

  RETURN public.network_merge(ST_Collect(pieces || net));
END
$$;

CREATE OR REPLACE FUNCTION public.add_trail_to_network(network_id bigint, line_geojson json)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  net geometry;
BEGIN
  SELECT geom INTO net FROM public.trail_networks WHERE id = network_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stinettverk % finnes ikke', network_id;
  END IF;

  UPDATE public.trail_networks
  SET geom = public.network_with_line(net, ST_SetSRID(ST_GeomFromGeoJSON(line_geojson::text), 4326))
  WHERE id = network_id;
END
$$;

-- The parts that come back unchanged are kept as they are; only the ones whose vertices were dragged
-- are added again, longest first, so a part dragged onto another merges into it instead of lying
-- beside it. Rebuilding the unchanged parts too would treat paths that really do run close together
-- as overlap. "Unchanged" allows for the rounding of the GeoJSON round trip (about a millimetre).
CREATE OR REPLACE FUNCTION public.set_network_geometry(network_id bigint, lines_geojson json)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  lines geometry := ST_SetSRID(ST_GeomFromGeoJSON(lines_geojson::text), 4326);
  stored geometry;
  net geometry;
  part geometry;
BEGIN
  SELECT geom INTO stored FROM public.trail_networks WHERE id = network_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stinettverk % finnes ikke', network_id;
  END IF;

  SELECT public.network_merge(ST_Collect(d.geom)) INTO net
  FROM ST_Dump(lines) d
  WHERE EXISTS (
    SELECT 1 FROM ST_Dump(stored) s
    WHERE ST_NPoints(s.geom) = ST_NPoints(d.geom) AND ST_HausdorffDistance(s.geom, d.geom) < 1e-8
  );

  FOR part IN
    SELECT d.geom FROM ST_Dump(lines) d
    WHERE geometrytype(d.geom) = 'LINESTRING' AND ST_NPoints(d.geom) >= 2
      AND NOT EXISTS (
        SELECT 1 FROM ST_Dump(stored) s
        WHERE ST_NPoints(s.geom) = ST_NPoints(d.geom) AND ST_HausdorffDistance(s.geom, d.geom) < 1e-8
      )
    ORDER BY ST_Length(d.geom::geography) DESC
  LOOP
    net := public.network_with_line(net, part);
  END LOOP;

  UPDATE public.trail_networks SET geom = net WHERE id = network_id;
END
$$;
