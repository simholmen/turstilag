-- Fase 4: stop lines piling up in a stinettverk, with a festeavstand (snap distance) the admin chooses.
--
-- Dragging a vertex onto another line left both lines there when they shared less than 25 m, and ends
-- tied onto the network a few metres from an existing junction left tiny parts (0–4 m) and triangles
-- around it — two or three lines on top of each other, hard to grab in the editor.
--
-- Every function that changes a network now takes snap_m, 0–20 m (8 by default, the old fixed value),
-- set with a slider in admin. With it:
--   * A loose path end within snap_m of the network is joined to it.
--   * Overlap is a stretch within min(3, snap_m) of the network for 6 m or more, or within snap_m for
--     2·snap_m + 9 m or more (25 m at the default). That stretch, and the vertices dragged onto it,
--     are dropped.
--   * After every change the network is tidied (network_tidy): a part lying all along the rest of the
--     network (90 % within min(3, snap_m)) is removed and the parts meeting it are moved onto the
--     network; a part shorter than min(5, snap_m) is removed and its two ends become one node; and of
--     two parts joining the same two nodes along the same way (within snap_m) only one is kept.
--   * At 0 nothing is snapped, merged or tidied: lines are only noded where they actually cross.
--   * The networks there are now are tidied once, at the default.

DROP FUNCTION public.add_trail_to_network(bigint, json);
DROP FUNCTION public.set_network_geometry(bigint, json);
DROP FUNCTION public.remove_network_part(bigint, integer);
DROP FUNCTION public.network_with_line(geometry, geometry);

CREATE FUNCTION public.network_tidy(net geometry, snap_m double precision DEFAULT 8)
RETURNS geometry
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  tol constant double precision := greatest(0, least(20, snap_m));
  min_part constant double precision := least(5, tol);
  close_tol constant double precision := least(3, tol);
  victim integer;
  a geometry;
  b geometry;
  core geometry;
  ends geometry;
BEGIN
  net := public.network_merge(net);
  IF tol <= 0 THEN
    RETURN net;
  END IF;

  FOR i IN 1..200 LOOP
    -- A part lying all along the rest of the network (90 % within close_tol) is a second line on top of
    -- it: drop it, and move the ends of the parts that met it onto the network they now lie beside
    SELECT d.path[1], ST_StartPoint(d.geom), ST_EndPoint(d.geom) INTO victim, a, b
    FROM ST_Dump(net) d
    WHERE ST_Length(d.geom::geography) >= min_part
      AND ST_Length(ST_Intersection(d.geom, ST_Buffer((
        SELECT ST_Collect(o.geom) FROM ST_Dump(net) o WHERE o.path[1] <> d.path[1]
      )::geography, close_tol)::geometry)::geography) >= 0.9 * ST_Length(d.geom::geography)
    ORDER BY ST_Length(d.geom::geography)
    LIMIT 1;

    IF victim IS NOT NULL THEN
      SELECT ST_Collect(d.geom) INTO core FROM ST_Dump(net) d
      WHERE d.path[1] <> victim
        AND NOT ST_Intersects(ST_Collect(ST_StartPoint(d.geom), ST_EndPoint(d.geom)), ST_Collect(a, b));
      SELECT public.network_merge(ST_Collect(
        CASE
          WHEN core IS NULL THEN d.geom
          WHEN (ST_Equals(ST_StartPoint(d.geom), a) OR ST_Equals(ST_StartPoint(d.geom), b))
            AND ST_DWithin(ST_StartPoint(d.geom)::geography, core::geography, tol)
            THEN ST_SetPoint(d.geom, 0, ST_ClosestPoint(core, ST_StartPoint(d.geom)))
          WHEN (ST_Equals(ST_EndPoint(d.geom), a) OR ST_Equals(ST_EndPoint(d.geom), b))
            AND ST_DWithin(ST_EndPoint(d.geom)::geography, core::geography, tol)
            THEN ST_SetPoint(d.geom, ST_NPoints(d.geom) - 1, ST_ClosestPoint(core, ST_EndPoint(d.geom)))
          ELSE d.geom
        END
      )) INTO net
      FROM ST_Dump(net) d
      WHERE d.path[1] <> victim;
      -- The moved ends lie on the network now; give it a vertex there so the union nodes them
      SELECT ST_Collect(e.p) INTO ends FROM (
        SELECT ST_StartPoint(d.geom) AS p FROM ST_Dump(net) d
        UNION ALL
        SELECT ST_EndPoint(d.geom) FROM ST_Dump(net) d
      ) e;
      IF ends IS NOT NULL THEN
        net := public.network_merge(ST_Snap(net, ends, 1e-7));
      END IF;
      CONTINUE;
    END IF;

    -- The shortest part under min_part: drop it and move every end at its far node onto its near node
    SELECT d.path[1], ST_StartPoint(d.geom), ST_EndPoint(d.geom) INTO victim, a, b
    FROM ST_Dump(net) d
    WHERE ST_Length(d.geom::geography) < min_part
    ORDER BY ST_Length(d.geom::geography)
    LIMIT 1;

    IF victim IS NULL THEN
      -- Otherwise a duplicate: two parts with the same two ends running within tol of each other
      -- (the longer of the two goes; degrees * 111 km overstates east–west distance, so it errs on
      -- keeping both)
      SELECT q.path[1] INTO victim
      FROM ST_Dump(net) p
      JOIN ST_Dump(net) q ON q.path[1] <> p.path[1]
        AND (ST_Length(q.geom) > ST_Length(p.geom) OR (ST_Length(q.geom) = ST_Length(p.geom) AND q.path[1] > p.path[1]))
        AND ((ST_Equals(ST_StartPoint(p.geom), ST_StartPoint(q.geom)) AND ST_Equals(ST_EndPoint(p.geom), ST_EndPoint(q.geom)))
          OR (ST_Equals(ST_StartPoint(p.geom), ST_EndPoint(q.geom)) AND ST_Equals(ST_EndPoint(p.geom), ST_StartPoint(q.geom))))
        AND ST_HausdorffDistance(p.geom, q.geom) * 111000 < tol
      LIMIT 1;
      EXIT WHEN victim IS NULL;
      a := NULL;
      b := NULL;
    END IF;

    SELECT public.network_merge(ST_Collect(
      CASE
        WHEN b IS NULL THEN d.geom
        WHEN ST_Equals(ST_StartPoint(d.geom), b) AND ST_Equals(ST_EndPoint(d.geom), b) THEN ST_SetPoint(ST_SetPoint(d.geom, 0, a), ST_NPoints(d.geom) - 1, a)
        WHEN ST_Equals(ST_StartPoint(d.geom), b) THEN ST_SetPoint(d.geom, 0, a)
        WHEN ST_Equals(ST_EndPoint(d.geom), b) THEN ST_SetPoint(d.geom, ST_NPoints(d.geom) - 1, a)
        ELSE d.geom
      END
    )) INTO net
    FROM ST_Dump(net) d
    WHERE d.path[1] <> victim;
  END LOOP;
  RETURN net;
END
$$;

CREATE FUNCTION public.network_with_line(net geometry, line geometry, snap_m double precision DEFAULT 8)
RETURNS geometry
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  tol constant double precision := greatest(0, least(20, snap_m));
  min_overlap constant double precision := 2 * tol + 9;  -- metres within tol before it counts as overlap
  close_tol constant double precision := least(3, tol);
  min_close constant double precision := 6;              -- metres within close_tol before it counts as overlap
  overlap_lines geometry;
  pieces geometry[] := '{}';
  piece geometry;
  ends geometry;
BEGIN
  IF net IS NULL OR ST_IsEmpty(net) THEN
    RETURN public.network_tidy(line, tol);
  END IF;
  IF tol <= 0 THEN
    RETURN public.network_merge(ST_Collect(net, line));
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

  SELECT ST_Collect(x.geom) INTO overlap_lines FROM (
    SELECT d.geom FROM ST_Dump(ST_Intersection(line, ST_Buffer(net::geography, tol)::geometry)) d
    WHERE geometrytype(d.geom) = 'LINESTRING' AND ST_Length(d.geom::geography) >= min_overlap
    UNION ALL
    SELECT d.geom FROM ST_Dump(ST_Intersection(line, ST_Buffer(net::geography, close_tol)::geometry)) d
    WHERE geometrytype(d.geom) = 'LINESTRING' AND ST_Length(d.geom::geography) >= min_close
  ) x;

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
    RETURN public.network_tidy(net, tol);
  END IF;

  -- Give the network a vertex exactly where each piece meets it, so the union nodes them together
  SELECT ST_Collect(p) INTO ends FROM (
    SELECT ST_StartPoint(x) AS p FROM unnest(pieces) x
    UNION ALL
    SELECT ST_EndPoint(x) FROM unnest(pieces) x
  ) e;
  net := ST_Snap(net, ends, 1e-7);

  RETURN public.network_tidy(ST_Collect(pieces || net), tol);
END
$$;

CREATE FUNCTION public.add_trail_to_network(network_id bigint, line_geojson json, snap_m double precision DEFAULT 8)
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
  SET geom = public.network_with_line(net, ST_SetSRID(ST_GeomFromGeoJSON(line_geojson::text), 4326), snap_m)
  WHERE id = network_id;
END
$$;

-- The parts that come back unchanged are kept as they are; only the ones whose vertices were dragged
-- are added again, longest first, so a part dragged onto another merges into it instead of lying
-- beside it. Rebuilding the unchanged parts too would treat paths that really do run close together
-- as overlap. "Unchanged" allows for the rounding of the GeoJSON round trip (about a millimetre).
CREATE FUNCTION public.set_network_geometry(network_id bigint, lines_geojson json, snap_m double precision DEFAULT 8)
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
    net := public.network_with_line(net, part, snap_m);
  END LOOP;

  UPDATE public.trail_networks SET geom = net WHERE id = network_id;
END
$$;

-- Tidies too, so removing a part between two close junctions doesn't leave a stub
CREATE FUNCTION public.remove_network_part(network_id bigint, part integer, snap_m double precision DEFAULT 8)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
AS $$
  UPDATE public.trail_networks n
  SET geom = public.network_tidy((SELECT ST_Collect(d.geom) FROM ST_Dump(n.geom) d WHERE d.path[1] <> part), snap_m)
  WHERE n.id = network_id;
$$;

-- ── Tidy the networks there are now ──────────────────────────────────────────────────────────────
UPDATE public.trail_networks SET geom = public.network_tidy(geom);
