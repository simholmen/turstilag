-- Fase 2: a parkering can be drawn as an area (the parking lot itself). Existing parkering points stay
-- valid, since a point is allowed for every kind.
--
-- Stiforbedringer become line-only in the frontend, but the database keeps accepting points and areas
-- for them: most of the existing ones are points and are redrawn one by one.

ALTER TABLE public.other_points DROP CONSTRAINT other_points_geom_kind_chk;
ALTER TABLE public.other_points ADD CONSTRAINT other_points_geom_kind_chk CHECK (
  geometrytype(geom) = 'POINT'
  OR (kind IN ('stiforbedring', 'annet') AND geometrytype(geom) IN ('LINESTRING', 'POLYGON'))
  OR (kind = 'parkering' AND geometrytype(geom) = 'POLYGON')
);
