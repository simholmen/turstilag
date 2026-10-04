-- Grunneier detail no longer tracks matrikkel numbers (gnr/bnr) or agreement status/text.
ALTER TABLE public.owners
  DROP COLUMN gnr,
  DROP COLUMN bnr,
  DROP COLUMN agreement_status,
  DROP COLUMN agreement_label;
