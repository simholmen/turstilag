-- Follow-up to 20261030150000_fase3_owner_contacts: the contact persons now live in owners.contacts,
-- so the single-contact columns go. No view depends on them (parcels_geojson reads parcels only).

ALTER TABLE public.owners
  DROP COLUMN IF EXISTS contact_name,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS email;
