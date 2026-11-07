-- Stinettverk: saving timed out ("57014 canceling statement due to statement timeout") on the larger
-- networks (around 100 parts). network_tidy looked for a part lying along the rest of the network by
-- buffering the whole rest of the network, as geography, once for every part: about 6 s on
-- Edlandsfjellet even when there was nothing to tidy, and then network_store ran on top of it, past
-- the 8 s limit for logged-in users.
--
-- Now only the parts within close_tol of a part go into its buffer. Parts farther away can't change
-- the result, so it stays the same, and the check takes about 0.3 s. Nothing else changes.

CREATE OR REPLACE FUNCTION public.network_tidy(net geometry, snap_m double precision DEFAULT 8)
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
        -- Only the parts near it: a bounding-box test (0.001° is over 50 m here) before the exact one
        SELECT ST_Collect(o.geom) FROM ST_Dump(net) o
        WHERE o.path[1] <> d.path[1]
          AND o.geom && ST_Expand(d.geom, 0.001)
          AND ST_DWithin(o.geom::geography, d.geom::geography, close_tol)
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
