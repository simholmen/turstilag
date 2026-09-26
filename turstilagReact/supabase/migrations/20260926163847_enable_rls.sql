-- Row Level Security: anyone can read map data, only admins can write.
-- An admin is a Supabase Auth user listed in public.admins. Add one with:
--   INSERT INTO public.admins (user_id) SELECT id FROM auth.users WHERE email = '...';

-- Admin allowlist
CREATE TABLE public.admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
-- No policies: the table is invisible through the API and managed from the dashboard/SQL only.

-- SECURITY DEFINER so policies can check admins without the caller needing access to it
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = (SELECT auth.uid()));
$$;

-- Policies per map table
ALTER TABLE public.hubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON public.hubs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin insert" ON public.hubs FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "Admin update" ON public.hubs FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "Admin delete" ON public.hubs FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

ALTER TABLE public.gjerdeklyvere ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON public.gjerdeklyvere FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin insert" ON public.gjerdeklyvere FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "Admin update" ON public.gjerdeklyvere FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "Admin delete" ON public.gjerdeklyvere FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

ALTER TABLE public.other_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON public.other_points FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin insert" ON public.other_points FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "Admin update" ON public.other_points FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY "Admin delete" ON public.other_points FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

-- Make the view respect the caller's RLS instead of running as its owner
ALTER VIEW public.all_features_geojson SET (security_invoker = true);
