-- Fase 3: grunneiere become eiendommer, each with up to three contact persons (grunneier, forpakter,
-- dyreeier, or the turstilag itself as the contact). A contact is { name, role, phone, email }, every
-- field free text and optional; they are always edited together with the eiendom, so they live in a
-- jsonb array on the row rather than in a table of their own.
--
-- The existing contact_name/phone/email become the first contact, with the role 'Grunneier'. The old
-- columns are left in place for now (the frontend no longer reads or writes them) and are dropped in
-- a later migration. Guarded on contacts being empty, so running this again changes nothing.

ALTER TABLE public.owners ADD COLUMN IF NOT EXISTS contacts jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.owners ADD CONSTRAINT owners_contacts_chk
  CHECK (jsonb_typeof(contacts) = 'array' AND jsonb_array_length(contacts) <= 3);

UPDATE public.owners
SET contacts = jsonb_build_array(jsonb_build_object(
  'name', COALESCE(contact_name, ''),
  'role', 'Grunneier',
  'phone', COALESCE(phone, ''),
  'email', COALESCE(email, '')
))
WHERE contacts = '[]'::jsonb AND COALESCE(contact_name, phone, email) IS NOT NULL;
