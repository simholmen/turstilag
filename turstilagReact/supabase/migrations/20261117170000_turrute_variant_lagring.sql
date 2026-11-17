-- Saving a turrute variant in one go: the variant itself and which alternative stretches it uses. The
-- stretches are swapped as a set inside the one transaction, so the overlap check (a deferred trigger
-- on route_variant_alternatives) sees the finished set, and a refused set leaves the old one in place.
-- A new variant goes last in the list. Runs as the caller, so RLS keeps it to admins.
CREATE OR REPLACE FUNCTION public.save_route_variant(
  variant_id bigint,
  route_id bigint,
  name text,
  difficulty text,
  climb text,
  description text,
  alternative_ids bigint[]
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  vid bigint := variant_id;
BEGIN
  IF vid IS NULL THEN
    INSERT INTO public.route_variants (route_id, name, difficulty, climb, description, sort_order)
    VALUES (
      save_route_variant.route_id, save_route_variant.name, save_route_variant.difficulty,
      save_route_variant.climb, save_route_variant.description,
      (SELECT coalesce(max(v.sort_order), 0) + 1 FROM public.route_variants v WHERE v.route_id = save_route_variant.route_id)
    )
    RETURNING route_variants.id INTO vid;
  ELSE
    UPDATE public.route_variants v
    SET name = save_route_variant.name, difficulty = save_route_variant.difficulty,
        climb = save_route_variant.climb, description = save_route_variant.description
    WHERE v.id = save_route_variant.variant_id AND v.route_id = save_route_variant.route_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Varianten finnes ikke';
    END IF;
  END IF;

  DELETE FROM public.route_variant_alternatives va WHERE va.variant_id = vid;
  INSERT INTO public.route_variant_alternatives (variant_id, alternative_id)
  SELECT vid, a FROM unnest(coalesce(alternative_ids, '{}'::bigint[])) a;
  SET CONSTRAINTS public.check_route_variant_alternatives IMMEDIATE;
  RETURN vid;
END
$$;
