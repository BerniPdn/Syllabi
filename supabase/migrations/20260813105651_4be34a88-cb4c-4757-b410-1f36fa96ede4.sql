CREATE OR REPLACE FUNCTION public.grade_scale_is_unique(extracted jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN extracted IS NULL OR jsonb_typeof(extracted->'grade_scale') <> 'array' THEN true
    ELSE (
      SELECT count(*) = count(DISTINCT upper(replace(btrim(step->>'letter'), ' ', '')))
         AND count(*) = count(DISTINCT (step->>'min'))
      FROM jsonb_array_elements(extracted->'grade_scale') AS step
      WHERE btrim(coalesce(step->>'letter', '')) <> ''
        AND step->>'min' IS NOT NULL
    )
  END;
$$;

ALTER TABLE public.courses
  ADD CONSTRAINT courses_grade_scale_unique
  CHECK (public.grade_scale_is_unique(extracted));