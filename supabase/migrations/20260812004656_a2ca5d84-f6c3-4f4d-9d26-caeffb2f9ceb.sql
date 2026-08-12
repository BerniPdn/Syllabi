ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS target_grade numeric NOT NULL DEFAULT 90
    CHECK (target_grade >= 0 AND target_grade <= 100);