CREATE TABLE IF NOT EXISTS public.school_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'School Name',
  tagline text,
  motto text,
  p_o_box text,
  town text,
  phone text,
  email text,
  paybill text,
  bank_details text,
  theme_color text DEFAULT '#0d5c3d',
  logo_url text,
  current_term_id uuid,
  footer_text text DEFAULT 'Powered by Brance Technologies',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School settings readable" ON public.school_settings;
CREATE POLICY "School settings readable" ON public.school_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins/head teachers manage school settings" ON public.school_settings;
CREATE POLICY "Admins/head teachers manage school settings" ON public.school_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'head_teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'head_teacher'));

DROP TRIGGER IF EXISTS trg_school_settings_updated_at ON public.school_settings;
CREATE TRIGGER trg_school_settings_updated_at
  BEFORE UPDATE ON public.school_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.school_settings (name, tagline, motto, theme_color)
SELECT 'School Name', 'Primary School Management', 'Foundation & Faithful Service', '#0d5c3d'
WHERE NOT EXISTS (SELECT 1 FROM public.school_settings);

-- Broaden admin-only RLS to also allow head_teacher
DROP POLICY IF EXISTS "Admins manage terms" ON public.terms;
CREATE POLICY "Admins/head teachers manage terms" ON public.terms
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'head_teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'head_teacher'));

DROP POLICY IF EXISTS "Admins manage leave policies" ON public.leave_policies;
CREATE POLICY "Admins/head teachers manage leave policies" ON public.leave_policies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'head_teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'head_teacher'));

DROP POLICY IF EXISTS "Admins manage entitlements" ON public.leave_entitlements;
CREATE POLICY "Admins/head teachers manage entitlements" ON public.leave_entitlements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'head_teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'head_teacher'));

-- Storage bucket for school assets (logo)
INSERT INTO storage.buckets (id, name, public)
VALUES ('school-assets', 'school-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "school-assets public read" ON storage.objects;
CREATE POLICY "school-assets public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'school-assets');

DROP POLICY IF EXISTS "school-assets admin write" ON storage.objects;
CREATE POLICY "school-assets admin write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'school-assets' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'head_teacher')));

DROP POLICY IF EXISTS "school-assets admin update" ON storage.objects;
CREATE POLICY "school-assets admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'school-assets' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'head_teacher')));

DROP POLICY IF EXISTS "school-assets admin delete" ON storage.objects;
CREATE POLICY "school-assets admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'school-assets' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'head_teacher')));