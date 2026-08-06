ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS extracted jsonb,
  ADD COLUMN IF NOT EXISTS extraction_error text;