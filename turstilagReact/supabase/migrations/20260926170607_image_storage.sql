-- Public bucket for map images. Anyone can view them, only admins can upload or delete.
-- Rows store the path inside the bucket (e.g. 'gjerdeklyver/<uuid>.webp') in their images column.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('images', 'images', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

-- Public buckets serve files by URL without a SELECT policy. Only admins get SELECT,
-- since Storage requires it for deletes; everyone else can't list the bucket.
CREATE POLICY "Admin read images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'images' AND (SELECT public.is_admin()));

CREATE POLICY "Admin upload images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'images' AND (SELECT public.is_admin()));

CREATE POLICY "Admin update images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'images' AND (SELECT public.is_admin()))
  WITH CHECK (bucket_id = 'images' AND (SELECT public.is_admin()));

CREATE POLICY "Admin delete images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'images' AND (SELECT public.is_admin()));
