-- Move the turområde connection from parcels (eiendommer) to owners (grunneiere): a
-- landowner can belong to one or more areas, via a join table, and their parcels no longer
-- carry their own area link.

CREATE TABLE public.owner_hubs (
  owner_id bigint NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  hub_id bigint NOT NULL REFERENCES public.hubs(id) ON DELETE CASCADE,
  PRIMARY KEY (owner_id, hub_id)
);
CREATE INDEX owner_hubs_hub_id_idx ON public.owner_hubs (hub_id);

ALTER TABLE public.owner_hubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON public.owner_hubs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin insert" ON public.owner_hubs FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "Admin delete" ON public.owner_hubs FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

-- Carry forward any area link that already existed on a parcel, onto the join table, so
-- existing data isn't silently dropped by the column removal below.
INSERT INTO public.owner_hubs (owner_id, hub_id)
SELECT DISTINCT owner_id, hub_id FROM public.parcels WHERE hub_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- parcels_geojson depends on parcels.hub_id, so it has to go before the column can be dropped
DROP VIEW public.parcels_geojson;

ALTER TABLE public.parcels DROP COLUMN hub_id;

CREATE VIEW public.parcels_geojson WITH (security_invoker = true) AS
SELECT
  p.id::text AS id,
  p.owner_id::text AS owner_id,
  p.teig,
  ST_Area(p.geom::geography) / 1000 AS daa,
  ST_AsGeoJSON(p.geom)::json AS geometry
FROM public.parcels p;
