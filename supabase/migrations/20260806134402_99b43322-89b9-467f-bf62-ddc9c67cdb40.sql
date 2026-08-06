CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Untitled course',
  status text NOT NULL DEFAULT 'processing',
  file_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own courses" ON public.courses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own courses" ON public.courses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own courses" ON public.courses
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own courses" ON public.courses
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX courses_user_id_idx ON public.courses (user_id);

CREATE POLICY "Users can upload their own syllabi" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'syllabi' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can read their own syllabi" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'syllabi' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own syllabi" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'syllabi' AND auth.uid()::text = (storage.foldername(name))[1]);