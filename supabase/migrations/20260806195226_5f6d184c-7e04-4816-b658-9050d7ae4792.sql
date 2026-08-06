CREATE TABLE public.insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  body jsonb NOT NULL,
  signature text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insights TO authenticated;
GRANT ALL ON public.insights TO service_role;

ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own insights" ON public.insights FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own insights" ON public.insights FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own insights" ON public.insights FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own insights" ON public.insights FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_insights_updated_at BEFORE UPDATE ON public.insights FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();