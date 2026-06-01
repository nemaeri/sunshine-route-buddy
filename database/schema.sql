-- ================================================================
-- JEC School Management System — Full Database Schema
-- Run this entire file in your Supabase SQL Editor (or psql).
-- ================================================================

-- ----------------------------------------------------------------
-- Migration: 20260523131021_9331cc4e-fc7c-4bb2-af10-3d44d27018ae.sql
-- ----------------------------------------------------------------

-- ============= ROLES =============
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'parent', 'driver', 'finance');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
CREATE TYPE public.gender AS ENUM ('male', 'female');

-- ============= UPDATED_AT TRIGGER FN =============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============= PROFILES =============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= USER ROLES =============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.raw_user_meta_data->>'phone');
  -- default role: parent (admin promotes later)
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'parent') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Profile policies
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Roles policies
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============= ACADEMIC =============
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                   -- e.g. "Grade 1 East"
  grade_level TEXT NOT NULL,            -- PP1, PP2, Grade 1..6
  stream TEXT,                          -- East/West/North
  class_teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  academic_year INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, academic_year)
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  grade_levels TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_no TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  gender public.gender,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  photo_url TEXT,
  enrolled_on DATE NOT NULL DEFAULT CURRENT_DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_students_class ON public.students(class_id);

CREATE TABLE public.student_parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'parent',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, parent_id)
);
ALTER TABLE public.student_parents ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sp_parent ON public.student_parents(parent_id);

-- helper: is this user a parent of this student?
CREATE OR REPLACE FUNCTION public.is_parent_of(_user UUID, _student UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.student_parents WHERE parent_id = _user AND student_id = _student);
$$;

-- helper: is this user the class teacher of this student's class?
CREATE OR REPLACE FUNCTION public.teaches_student(_user UUID, _student UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.classes c ON c.id = s.class_id
    WHERE s.id = _student AND c.class_teacher_id = _user
  );
$$;

CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_no TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  designation TEXT,
  department TEXT,
  kra_pin TEXT,
  nhif_no TEXT,
  nssf_no TEXT,
  basic_salary NUMERIC(12,2) DEFAULT 0,
  hired_on DATE,
  phone TEXT,
  email TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER staff_updated_at BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status public.attendance_status NOT NULL DEFAULT 'present',
  note TEXT,
  marked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_attendance_date ON public.attendance(date);
CREATE INDEX idx_attendance_class ON public.attendance(class_id, date);

CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all',  -- 'all' | 'parents' | 'staff' | 'class'
  target_class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- ============= BUS / TRANSPORT =============
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_no TEXT UNIQUE NOT NULL,
  label TEXT,
  capacity INT DEFAULT 33,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sequence INT NOT NULL DEFAULT 0,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  scheduled_pickup TIME,
  scheduled_dropoff TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stops ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_stops_route ON public.stops(route_id, sequence);

CREATE TABLE public.route_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift TEXT NOT NULL DEFAULT 'morning', -- morning | evening
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | in_progress | completed | cancelled
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (route_id, service_date, shift)
);
ALTER TABLE public.route_assignments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ra_driver_date ON public.route_assignments(driver_id, service_date);

CREATE TABLE public.bus_positions (
  id BIGSERIAL PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.route_assignments(id) ON DELETE CASCADE,
  lat NUMERIC(10,7) NOT NULL,
  lng NUMERIC(10,7) NOT NULL,
  heading NUMERIC(6,2),
  speed_kph NUMERIC(6,2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bus_positions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_bp_assignment_time ON public.bus_positions(assignment_id, recorded_at DESC);

CREATE TABLE public.stop_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.route_assignments(id) ON DELETE CASCADE,
  stop_id UUID NOT NULL REFERENCES public.stops(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- arrived | picked_up | dropped_off | departed
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);
ALTER TABLE public.stop_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_se_assignment ON public.stop_events(assignment_id, recorded_at DESC);

CREATE TABLE public.student_stop_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  stop_id UUID NOT NULL REFERENCES public.stops(id) ON DELETE CASCADE,
  shift TEXT NOT NULL DEFAULT 'both', -- morning | evening | both
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, stop_id, shift)
);
ALTER TABLE public.student_stop_assignments ENABLE ROW LEVEL SECURITY;

-- ============= RLS POLICIES =============

-- Classes: everyone authenticated can read; admins manage
CREATE POLICY "Classes readable" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage classes" ON public.classes FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Subjects: readable to all auth; admin manages
CREATE POLICY "Subjects readable" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage subjects" ON public.subjects FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Students: admin/teacher see all; parents see own children
CREATE POLICY "Admins see all students" ON public.students FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'finance'));
CREATE POLICY "Parents see own children" ON public.students FOR SELECT TO authenticated
  USING (public.is_parent_of(auth.uid(), id));
CREATE POLICY "Admins manage students" ON public.students FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- student_parents
CREATE POLICY "Parent sees own links" ON public.student_parents FOR SELECT TO authenticated
  USING (parent_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "Admins manage links" ON public.student_parents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Staff
CREATE POLICY "Admins/staff read staff" ON public.staff FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'finance') OR user_id = auth.uid());
CREATE POLICY "Admins manage staff" ON public.staff FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Attendance
CREATE POLICY "Admin/teacher read attendance" ON public.attendance FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "Parents read own children attendance" ON public.attendance FOR SELECT TO authenticated
  USING (public.is_parent_of(auth.uid(), student_id));
CREATE POLICY "Teachers/admin write attendance" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "Teachers/admin update attendance" ON public.attendance FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "Admin delete attendance" ON public.attendance FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- Announcements: all auth read; admin/teacher write
CREATE POLICY "Announcements readable" ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/teacher write announcements" ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "Admin manage announcements" ON public.announcements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Vehicles & routes & stops: all auth read; admin manage
CREATE POLICY "Vehicles readable" ON public.vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage vehicles" ON public.vehicles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Routes readable" ON public.routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage routes" ON public.routes FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Stops readable" ON public.stops FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage stops" ON public.stops FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Route assignments
CREATE POLICY "Admin read all assignments" ON public.route_assignments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR driver_id = auth.uid());
CREATE POLICY "Parents read assignments for their route" ON public.route_assignments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.student_stop_assignments ssa
      JOIN public.stops s ON s.id = ssa.stop_id
      JOIN public.student_parents sp ON sp.student_id = ssa.student_id
      WHERE sp.parent_id = auth.uid() AND s.route_id = route_assignments.route_id
    )
  );
CREATE POLICY "Admin manage assignments" ON public.route_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Driver update own assignment" ON public.route_assignments FOR UPDATE TO authenticated
  USING (driver_id = auth.uid());

-- Bus positions
CREATE POLICY "Read positions for own route" ON public.bus_positions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR
    EXISTS (SELECT 1 FROM public.route_assignments ra WHERE ra.id = assignment_id AND (
      ra.driver_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.student_stop_assignments ssa
        JOIN public.stops s ON s.id = ssa.stop_id
        JOIN public.student_parents sp ON sp.student_id = ssa.student_id
        WHERE sp.parent_id = auth.uid() AND s.route_id = ra.route_id
      )
    ))
  );
CREATE POLICY "Driver writes positions" ON public.bus_positions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.route_assignments ra WHERE ra.id = assignment_id AND ra.driver_id = auth.uid()));

-- Stop events
CREATE POLICY "Read stop events for own route" ON public.stop_events FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR
    EXISTS (SELECT 1 FROM public.route_assignments ra WHERE ra.id = assignment_id AND (
      ra.driver_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.student_stop_assignments ssa
        JOIN public.stops s ON s.id = ssa.stop_id
        JOIN public.student_parents sp ON sp.student_id = ssa.student_id
        WHERE sp.parent_id = auth.uid() AND s.route_id = ra.route_id
      )
    ))
  );
CREATE POLICY "Driver writes stop events" ON public.stop_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.route_assignments ra WHERE ra.id = assignment_id AND ra.driver_id = auth.uid()));

-- Student stop assignments
CREATE POLICY "Read student stop assignments" ON public.student_stop_assignments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_parent_of(auth.uid(), student_id));
CREATE POLICY "Admin manage student stop assignments" ON public.student_stop_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============= REALTIME for bus =============
ALTER PUBLICATION supabase_realtime ADD TABLE public.bus_positions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stop_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.route_assignments;

-- ----------------------------------------------------------------
-- Migration: 20260523131034_d4428bdd-3a4c-4c2e-8a81-3fe55c9b281f.sql
-- ----------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_parent_of(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.teaches_student(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------
-- Migration: 20260523140115_b509d36e-0f7a-44fa-a254-ac8a40a31da0.sql
-- ----------------------------------------------------------------

-- ============ TERMS ============
CREATE TABLE public.terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year integer NOT NULL,
  term_number integer NOT NULL CHECK (term_number BETWEEN 1 AND 3),
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (academic_year, term_number)
);
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Terms readable" ON public.terms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage terms" ON public.terms FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- ============ ASSESSMENTS ============
CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  term_id uuid NOT NULL,
  name text NOT NULL,
  assessment_type text NOT NULL DEFAULT 'cat',
  max_score numeric NOT NULL DEFAULT 100,
  assessment_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assessments readable by staff/admin" ON public.assessments FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'teacher'));
CREATE POLICY "Parents read assessments of their child class"
  ON public.assessments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.student_parents sp ON sp.student_id = s.id
    WHERE sp.parent_id = auth.uid() AND s.class_id = assessments.class_id
  ));
CREATE POLICY "Admin/teacher manage assessments" ON public.assessments FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'teacher'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'teacher'));

-- ============ ASSESSMENT SCORES ============
CREATE TABLE public.assessment_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL,
  student_id uuid NOT NULL,
  score numeric,
  performance_level text,
  comment text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, student_id)
);
ALTER TABLE public.assessment_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read all scores" ON public.assessment_scores FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'teacher'));
CREATE POLICY "Parents read own children scores" ON public.assessment_scores FOR SELECT TO authenticated
  USING (is_parent_of(auth.uid(), student_id));
CREATE POLICY "Staff manage scores" ON public.assessment_scores FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'teacher'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'teacher'));
CREATE TRIGGER assessment_scores_updated_at BEFORE UPDATE ON public.assessment_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ FEE ITEMS (catalog) ============
CREATE TABLE public.fee_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_level text NOT NULL,
  term_id uuid NOT NULL,
  item_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fee_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fee items readable by staff" ON public.fee_items FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance') OR has_role(auth.uid(),'teacher'));
CREATE POLICY "Admin/finance manage fee items" ON public.fee_items FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance'));

-- ============ INVOICES ============
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  term_id uuid NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  due_date date,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read invoices" ON public.invoices FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance'));
CREATE POLICY "Parents read own children invoices" ON public.invoices FOR SELECT TO authenticated
  USING (is_parent_of(auth.uid(), student_id));
CREATE POLICY "Admin/finance manage invoices" ON public.invoices FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance'));
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PAYMENTS ============
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  amount numeric NOT NULL,
  method text NOT NULL DEFAULT 'mpesa',
  reference text,
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read payments" ON public.payments FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance'));
CREATE POLICY "Parents read own children payments" ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = payments.invoice_id AND is_parent_of(auth.uid(), i.student_id)
  ));
CREATE POLICY "Admin/finance write payments" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance'));
CREATE POLICY "Admin/finance update payments" ON public.payments FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance'));
CREATE POLICY "Admin delete payments" ON public.payments FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

-- ============ PAYROLL ============
CREATE TABLE public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year integer NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_year, period_month)
);
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance read payroll runs" ON public.payroll_runs FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance'));
CREATE POLICY "Admin/finance manage payroll runs" ON public.payroll_runs FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance'));

CREATE TABLE public.payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  basic_salary numeric NOT NULL DEFAULT 0,
  allowances numeric NOT NULL DEFAULT 0,
  gross_pay numeric NOT NULL DEFAULT 0,
  paye numeric NOT NULL DEFAULT 0,
  nhif numeric NOT NULL DEFAULT 0,
  nssf numeric NOT NULL DEFAULT 0,
  housing_levy numeric NOT NULL DEFAULT 0,
  other_deductions numeric NOT NULL DEFAULT 0,
  net_pay numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payroll_run_id, staff_id)
);
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance read all payslips" ON public.payslips FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance'));
CREATE POLICY "Staff read own payslip" ON public.payslips FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.id = payslips.staff_id AND s.user_id = auth.uid()));
CREATE POLICY "Admin/finance manage payslips" ON public.payslips FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance'));

-- ----------------------------------------------------------------
-- Migration: 20260523145146_a3283019-b045-40a2-a7e9-d846b901e132.sql
-- ----------------------------------------------------------------

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS boarding boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lunch boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS home_address text,
  ADD COLUMN IF NOT EXISTS parent_name text,
  ADD COLUMN IF NOT EXISTS parent_phone text,
  ADD COLUMN IF NOT EXISTS parent_email text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- ----------------------------------------------------------------
-- Migration: 20260523153323_aacaf018-c3df-45ef-9677-d62195d56c2d.sql
-- ----------------------------------------------------------------

CREATE TABLE public.staff_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  role_label text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, role_label)
);

CREATE INDEX idx_staff_roles_staff_id ON public.staff_roles(staff_id);

ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage staff roles"
ON public.staff_roles FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff read roles"
ON public.staff_roles FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finance'::app_role)
  OR EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_roles.staff_id AND s.user_id = auth.uid())
);

-- ----------------------------------------------------------------
-- Migration: 20260523155050_08753a7b-92ac-4387-af10-eafd4d342f6f.sql
-- ----------------------------------------------------------------
-- Leave requests table
CREATE TABLE public.leave_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL DEFAULT 'annual',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT leave_dates_valid CHECK (end_date >= start_date),
  CONSTRAINT leave_status_valid CHECK (status IN ('pending','approved','rejected','cancelled'))
);

CREATE INDEX idx_leave_requests_staff ON public.leave_requests(staff_id);
CREATE INDEX idx_leave_requests_status ON public.leave_requests(status);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Admins manage everything
CREATE POLICY "Admins manage leave requests"
  ON public.leave_requests
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Staff can read their own requests
CREATE POLICY "Staff read own leave"
  ON public.leave_requests
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.staff s WHERE s.id = leave_requests.staff_id AND s.user_id = auth.uid())
  );

-- Staff can submit their own pending requests
CREATE POLICY "Staff submit own leave"
  ON public.leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pending'
    AND EXISTS (SELECT 1 FROM public.staff s WHERE s.id = leave_requests.staff_id AND s.user_id = auth.uid())
  );

-- Staff can cancel their own pending requests
CREATE POLICY "Staff cancel own pending leave"
  ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (
    status = 'pending'
    AND EXISTS (SELECT 1 FROM public.staff s WHERE s.id = leave_requests.staff_id AND s.user_id = auth.uid())
  );

CREATE TRIGGER update_leave_requests_updated_at
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- ----------------------------------------------------------------
-- Migration: 20260523161343_ba3b765d-6b2f-46b0-9d95-95f0f27fc7fb.sql
-- ----------------------------------------------------------------

-- 1. Leave policies (org-wide defaults per leave type)
CREATE TABLE public.leave_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_type text NOT NULL UNIQUE,
  default_days integer,                  -- NULL = unlimited (e.g. unpaid)
  carryover_pct numeric NOT NULL DEFAULT 50,  -- % of unused days that carry to next year
  max_carryover_days integer,            -- optional cap, NULL = no cap
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leave_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage leave policies" ON public.leave_policies
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated read leave policies" ON public.leave_policies
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_leave_policies_updated
  BEFORE UPDATE ON public.leave_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults
INSERT INTO public.leave_policies (leave_type, default_days, carryover_pct) VALUES
  ('annual', 21, 50),
  ('sick', 14, 50),
  ('compassionate', 5, 50),
  ('maternity', 90, 0),
  ('paternity', 14, 0),
  ('study', 10, 50),
  ('unpaid', NULL, 0),
  ('other', 5, 0);

-- 2. Per-staff entitlements per year (overrides + carryover tracking)
CREATE TABLE public.leave_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  leave_type text NOT NULL,
  year integer NOT NULL,
  entitled_days integer,                -- if NULL, falls back to policy default
  carried_over_days integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, leave_type, year)
);
ALTER TABLE public.leave_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage entitlements" ON public.leave_entitlements
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff read own entitlements" ON public.leave_entitlements
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.staff s WHERE s.id = leave_entitlements.staff_id AND s.user_id = auth.uid())
  );

CREATE TRIGGER trg_leave_entitlements_updated
  BEFORE UPDATE ON public.leave_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Live balance view: entitled (+ carryover) - approved used
CREATE OR REPLACE VIEW public.leave_balances AS
WITH years AS (
  SELECT DISTINCT EXTRACT(YEAR FROM start_date)::int AS year FROM public.leave_requests
  UNION SELECT EXTRACT(YEAR FROM CURRENT_DATE)::int
),
matrix AS (
  SELECT s.id AS staff_id, p.leave_type, y.year, p.default_days AS policy_days
  FROM public.staff s
  CROSS JOIN public.leave_policies p
  CROSS JOIN years y
  WHERE s.active = true
),
used AS (
  SELECT staff_id, leave_type, EXTRACT(YEAR FROM start_date)::int AS year,
         COALESCE(SUM(days), 0) AS used_days
  FROM public.leave_requests
  WHERE status = 'approved'
  GROUP BY staff_id, leave_type, EXTRACT(YEAR FROM start_date)::int
)
SELECT
  m.staff_id,
  m.leave_type,
  m.year,
  COALESCE(e.entitled_days, m.policy_days) AS entitled_days,
  COALESCE(e.carried_over_days, 0) AS carried_over_days,
  COALESCE(u.used_days, 0) AS used_days,
  CASE
    WHEN COALESCE(e.entitled_days, m.policy_days) IS NULL THEN NULL
    ELSE COALESCE(e.entitled_days, m.policy_days) + COALESCE(e.carried_over_days, 0) - COALESCE(u.used_days, 0)
  END AS remaining_days
FROM matrix m
LEFT JOIN public.leave_entitlements e
  ON e.staff_id = m.staff_id AND e.leave_type = m.leave_type AND e.year = m.year
LEFT JOIN used u
  ON u.staff_id = m.staff_id AND u.leave_type = m.leave_type AND u.year = m.year;

-- 4. Trigger to enforce balance on approval
CREATE OR REPLACE FUNCTION public.enforce_leave_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int;
  v_policy_days int;
  v_entitled int;
  v_carry int;
  v_used int;
  v_remaining int;
BEGIN
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;
  -- Skip if no status change to approved
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;

  v_year := EXTRACT(YEAR FROM NEW.start_date)::int;

  SELECT default_days INTO v_policy_days FROM public.leave_policies WHERE leave_type = NEW.leave_type;
  SELECT entitled_days, carried_over_days
    INTO v_entitled, v_carry
    FROM public.leave_entitlements
   WHERE staff_id = NEW.staff_id AND leave_type = NEW.leave_type AND year = v_year;

  v_entitled := COALESCE(v_entitled, v_policy_days);
  v_carry := COALESCE(v_carry, 0);

  -- NULL entitled = unlimited (e.g. unpaid)
  IF v_entitled IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(days), 0) INTO v_used
  FROM public.leave_requests
  WHERE staff_id = NEW.staff_id
    AND leave_type = NEW.leave_type
    AND status = 'approved'
    AND EXTRACT(YEAR FROM start_date)::int = v_year
    AND id <> NEW.id;

  v_remaining := v_entitled + v_carry - v_used;

  IF NEW.days > v_remaining THEN
    RAISE EXCEPTION 'Insufficient % leave balance: % day(s) remaining, % requested', NEW.leave_type, v_remaining, NEW.days;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_leave_balance
  BEFORE INSERT OR UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_leave_balance();

-- ----------------------------------------------------------------
-- Migration: 20260523161358_9587ca15-3a68-4bec-bd1e-f6fa67870dbe.sql
-- ----------------------------------------------------------------

ALTER VIEW public.leave_balances SET (security_invoker = true);
REVOKE EXECUTE ON FUNCTION public.enforce_leave_balance() FROM anon, authenticated, public;

-- ----------------------------------------------------------------
-- Migration: 20260523162531_401a0720-837e-4252-ba54-cf5000aff272.sql
-- ----------------------------------------------------------------
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_teacher';
-- ----------------------------------------------------------------
-- Migration: 20260523162600_dbca87a3-fd3c-41b2-aa80-657e5cf91676.sql
-- ----------------------------------------------------------------
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
-- ----------------------------------------------------------------
-- Migration: 20260523164807_33270939-30cb-4156-91e0-fe8966f9f898.sql
-- ----------------------------------------------------------------

-- 1. Staff category enum
DO $$ BEGIN
  CREATE TYPE public.staff_category AS ENUM ('teaching', 'non_teaching', 'support');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Add to staff
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS staff_category public.staff_category NOT NULL DEFAULT 'non_teaching';

-- 3. Add to leave_policies + new uniqueness
ALTER TABLE public.leave_policies
  ADD COLUMN IF NOT EXISTS staff_category public.staff_category NOT NULL DEFAULT 'non_teaching';

-- Drop old unique on leave_type if any, then enforce (leave_type, staff_category)
DO $$ BEGIN
  ALTER TABLE public.leave_policies DROP CONSTRAINT IF EXISTS leave_policies_leave_type_key;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS leave_policies_type_category_uniq
  ON public.leave_policies (leave_type, staff_category);

-- 4. Seed policies for each (leave_type, category) combo that doesn't exist yet.
--    Suggested defaults — admins can tweak in Settings.
INSERT INTO public.leave_policies (leave_type, staff_category, default_days, carryover_pct, max_carryover_days)
VALUES
  -- Teaching staff
  ('annual',        'teaching', 30, 50, 10),
  ('sick',          'teaching', 14, 0,  0),
  ('compassionate', 'teaching', 7,  0,  0),
  ('maternity',     'teaching', 90, 0,  0),
  ('paternity',     'teaching', 14, 0,  0),
  ('study',         'teaching', 10, 0,  0),
  ('unpaid',        'teaching', NULL, 0, 0),
  -- Non-teaching staff
  ('annual',        'non_teaching', 21, 50, 7),
  ('sick',          'non_teaching', 14, 0,  0),
  ('compassionate', 'non_teaching', 5,  0,  0),
  ('maternity',     'non_teaching', 90, 0,  0),
  ('paternity',     'non_teaching', 14, 0,  0),
  ('study',         'non_teaching', 5,  0,  0),
  ('unpaid',        'non_teaching', NULL, 0, 0),
  -- Support staff
  ('annual',        'support', 15, 50, 5),
  ('sick',          'support', 14, 0,  0),
  ('compassionate', 'support', 5,  0,  0),
  ('maternity',     'support', 90, 0,  0),
  ('paternity',     'support', 14, 0,  0),
  ('study',         'support', 0,  0,  0),
  ('unpaid',        'support', NULL, 0, 0)
ON CONFLICT (leave_type, staff_category) DO NOTHING;

-- 5. Update enforce_leave_balance to look up policy by staff category
CREATE OR REPLACE FUNCTION public.enforce_leave_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year int;
  v_category public.staff_category;
  v_policy_days int;
  v_entitled int;
  v_carry int;
  v_used int;
  v_remaining int;
BEGIN
  IF NEW.status <> 'approved' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN RETURN NEW; END IF;

  v_year := EXTRACT(YEAR FROM NEW.start_date)::int;

  SELECT staff_category INTO v_category FROM public.staff WHERE id = NEW.staff_id;

  SELECT default_days INTO v_policy_days
    FROM public.leave_policies
   WHERE leave_type = NEW.leave_type AND staff_category = COALESCE(v_category, 'non_teaching');

  SELECT entitled_days, carried_over_days INTO v_entitled, v_carry
    FROM public.leave_entitlements
   WHERE staff_id = NEW.staff_id AND leave_type = NEW.leave_type AND year = v_year;

  v_entitled := COALESCE(v_entitled, v_policy_days);
  v_carry := COALESCE(v_carry, 0);

  IF v_entitled IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(days), 0) INTO v_used
    FROM public.leave_requests
   WHERE staff_id = NEW.staff_id
     AND leave_type = NEW.leave_type
     AND status = 'approved'
     AND EXTRACT(YEAR FROM start_date)::int = v_year
     AND id <> NEW.id;

  v_remaining := v_entitled + v_carry - v_used;

  IF NEW.days > v_remaining THEN
    RAISE EXCEPTION 'Insufficient % leave balance: % day(s) remaining, % requested', NEW.leave_type, v_remaining, NEW.days;
  END IF;

  RETURN NEW;
END;
$function$;

-- ----------------------------------------------------------------
-- Migration: 20260523165133_8aedaddf-0938-4e2d-a48e-89aaf322e9ad.sql
-- ----------------------------------------------------------------

-- 1. Employment type enum
DO $$ BEGIN
  CREATE TYPE public.employment_type AS ENUM ('permanent', 'contract');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Add to staff
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS employment_type public.employment_type NOT NULL DEFAULT 'permanent';

-- 3. Add to leave_policies
ALTER TABLE public.leave_policies
  ADD COLUMN IF NOT EXISTS employment_type public.employment_type NOT NULL DEFAULT 'permanent';

-- Replace unique index with new composite
DROP INDEX IF EXISTS public.leave_policies_type_category_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS leave_policies_type_cat_emp_uniq
  ON public.leave_policies (leave_type, staff_category, employment_type);

-- 4. Seed contract-staff policies (permanent rows already exist from prior migration)
INSERT INTO public.leave_policies (leave_type, staff_category, employment_type, default_days, carryover_pct, max_carryover_days)
VALUES
  -- Teaching · Contract (typically lower entitlements, no carryover)
  ('annual',        'teaching',     'contract', 21, 0, 0),
  ('sick',          'teaching',     'contract', 7,  0, 0),
  ('compassionate', 'teaching',     'contract', 3,  0, 0),
  ('maternity',     'teaching',     'contract', 90, 0, 0),
  ('paternity',     'teaching',     'contract', 14, 0, 0),
  ('study',         'teaching',     'contract', 0,  0, 0),
  ('unpaid',        'teaching',     'contract', NULL, 0, 0),
  -- Non-teaching · Contract
  ('annual',        'non_teaching', 'contract', 15, 0, 0),
  ('sick',          'non_teaching', 'contract', 7,  0, 0),
  ('compassionate', 'non_teaching', 'contract', 3,  0, 0),
  ('maternity',     'non_teaching', 'contract', 90, 0, 0),
  ('paternity',     'non_teaching', 'contract', 14, 0, 0),
  ('study',         'non_teaching', 'contract', 0,  0, 0),
  ('unpaid',        'non_teaching', 'contract', NULL, 0, 0),
  -- Support · Contract
  ('annual',        'support',      'contract', 10, 0, 0),
  ('sick',          'support',      'contract', 7,  0, 0),
  ('compassionate', 'support',      'contract', 3,  0, 0),
  ('maternity',     'support',      'contract', 90, 0, 0),
  ('paternity',     'support',      'contract', 14, 0, 0),
  ('study',         'support',      'contract', 0,  0, 0),
  ('unpaid',        'support',      'contract', NULL, 0, 0)
ON CONFLICT (leave_type, staff_category, employment_type) DO NOTHING;

-- 5. Update enforce_leave_balance to match on both category and employment type
CREATE OR REPLACE FUNCTION public.enforce_leave_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year int;
  v_category public.staff_category;
  v_emp public.employment_type;
  v_policy_days int;
  v_entitled int;
  v_carry int;
  v_used int;
  v_remaining int;
BEGIN
  IF NEW.status <> 'approved' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN RETURN NEW; END IF;

  v_year := EXTRACT(YEAR FROM NEW.start_date)::int;

  SELECT staff_category, employment_type INTO v_category, v_emp
    FROM public.staff WHERE id = NEW.staff_id;

  SELECT default_days INTO v_policy_days
    FROM public.leave_policies
   WHERE leave_type = NEW.leave_type
     AND staff_category = COALESCE(v_category, 'non_teaching')
     AND employment_type = COALESCE(v_emp, 'permanent');

  SELECT entitled_days, carried_over_days INTO v_entitled, v_carry
    FROM public.leave_entitlements
   WHERE staff_id = NEW.staff_id AND leave_type = NEW.leave_type AND year = v_year;

  v_entitled := COALESCE(v_entitled, v_policy_days);
  v_carry := COALESCE(v_carry, 0);

  IF v_entitled IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(days), 0) INTO v_used
    FROM public.leave_requests
   WHERE staff_id = NEW.staff_id
     AND leave_type = NEW.leave_type
     AND status = 'approved'
     AND EXTRACT(YEAR FROM start_date)::int = v_year
     AND id <> NEW.id;

  v_remaining := v_entitled + v_carry - v_used;

  IF NEW.days > v_remaining THEN
    RAISE EXCEPTION 'Insufficient % leave balance: % day(s) remaining, % requested', NEW.leave_type, v_remaining, NEW.days;
  END IF;

  RETURN NEW;
END;
$function$;

-- ----------------------------------------------------------------
-- Migration: 20260523165706_105ee632-4791-4205-a1dc-66d67daed08c.sql
-- ----------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_parent_of(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teaches_student(uuid, uuid) TO anon, authenticated;

-- ----------------------------------------------------------------
-- Migration: 20260523175236_2d1e809b-eea2-4880-864b-d41089ff0e0f.sql
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.timetable_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  subject_id uuid,
  teacher_id uuid,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time time NOT NULL,
  end_time time NOT NULL,
  room text,
  term_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Timetable readable" ON public.timetable_slots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/teacher manage timetable" ON public.timetable_slots
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'head_teacher'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'head_teacher'::app_role));

CREATE INDEX IF NOT EXISTS timetable_slots_class_idx ON public.timetable_slots(class_id, day_of_week);

CREATE TRIGGER update_timetable_slots_updated_at
  BEFORE UPDATE ON public.timetable_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- ----------------------------------------------------------------
-- Migration: 20260523213709_05cb1147-9100-44b1-95cc-26a0939f0b66.sql
-- ----------------------------------------------------------------

ALTER TABLE public.fee_items
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'common',
  ADD COLUMN IF NOT EXISTS grade_from text,
  ADD COLUMN IF NOT EXISTS grade_to text,
  ADD COLUMN IF NOT EXISTS applies_to text NOT NULL DEFAULT 'all';

ALTER TABLE public.fee_items
  ALTER COLUMN grade_level DROP NOT NULL;

ALTER TABLE public.fee_items
  DROP CONSTRAINT IF EXISTS fee_items_kind_check;
ALTER TABLE public.fee_items
  ADD CONSTRAINT fee_items_kind_check CHECK (kind IN ('common','band'));

ALTER TABLE public.fee_items
  DROP CONSTRAINT IF EXISTS fee_items_applies_to_check;
ALTER TABLE public.fee_items
  ADD CONSTRAINT fee_items_applies_to_check CHECK (applies_to IN ('all','day','boarding','lunch'));

-- ----------------------------------------------------------------
-- Migration: 20260523235517_87634dd8-f2ce-46ee-81b3-1aa290a92144.sql
-- ----------------------------------------------------------------

ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS paid_on date,
  ADD COLUMN IF NOT EXISTS paid_method text,
  ADD COLUMN IF NOT EXISTS paid_reference text,
  ADD COLUMN IF NOT EXISTS paid_amount numeric,
  ADD COLUMN IF NOT EXISTS paid_by uuid;

CREATE INDEX IF NOT EXISTS payslips_payroll_run_idx ON public.payslips(payroll_run_id);
CREATE INDEX IF NOT EXISTS payslips_paid_on_idx ON public.payslips(paid_on);

-- ----------------------------------------------------------------
-- Migration: 20260524021501_1030c2f1-fe0d-4bf0-8b93-660f82e62c26.sql
-- ----------------------------------------------------------------

-- Chart of accounts
CREATE TYPE public.account_type AS ENUM ('asset','liability','equity','income','expense');
CREATE TYPE public.normal_side AS ENUM ('debit','credit');

CREATE TABLE public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  account_type public.account_type NOT NULL,
  normal_side public.normal_side NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_no text NOT NULL UNIQUE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  memo text,
  reference text,
  posted boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  line_memo text,
  position int NOT NULL DEFAULT 0,
  CHECK (debit >= 0 AND credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0))
);

CREATE INDEX idx_journal_lines_entry ON public.journal_lines(entry_id);
CREATE INDEX idx_journal_lines_account ON public.journal_lines(account_id);
CREATE INDEX idx_journal_entries_date ON public.journal_entries(entry_date);

-- updated_at triggers
CREATE TRIGGER trg_coa_updated BEFORE UPDATE ON public.chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_je_updated BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Balance validation trigger
CREATE OR REPLACE FUNCTION public.assert_journal_balanced()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_entry uuid; v_dr numeric; v_cr numeric;
BEGIN
  v_entry := COALESCE(NEW.entry_id, OLD.entry_id);
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
    INTO v_dr, v_cr FROM public.journal_lines WHERE entry_id = v_entry;
  IF v_dr <> v_cr THEN
    RAISE EXCEPTION 'Journal entry % unbalanced: debits=% credits=%', v_entry, v_dr, v_cr;
  END IF;
  IF v_dr = 0 THEN
    RAISE EXCEPTION 'Journal entry % has no amounts', v_entry;
  END IF;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER trg_journal_balanced
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.assert_journal_balanced();

-- RLS
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance read coa" ON public.chart_of_accounts FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance'));
CREATE POLICY "Finance manage coa" ON public.chart_of_accounts FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance'));

CREATE POLICY "Finance read je" ON public.journal_entries FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance'));
CREATE POLICY "Finance manage je" ON public.journal_entries FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance'));

CREATE POLICY "Finance read jl" ON public.journal_lines FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance'));
CREATE POLICY "Finance manage jl" ON public.journal_lines FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance'));

-- Starter chart of accounts
INSERT INTO public.chart_of_accounts (code, name, account_type, normal_side, description) VALUES
  ('1000','Cash on Hand','asset','debit','Petty cash held at the school office'),
  ('1010','Bank — Equity Bank','asset','debit','School operating bank account'),
  ('1020','M-Pesa Paybill','asset','debit','Funds in the M-Pesa paybill float'),
  ('1100','Accounts Receivable — Fees','asset','debit','Outstanding student fee balances'),
  ('1500','Property & Equipment','asset','debit','Buses, computers, furniture'),
  ('2000','Accounts Payable','liability','credit','Amounts owed to suppliers'),
  ('2100','PAYE Payable','liability','credit','PAYE withheld, owed to KRA'),
  ('2110','NHIF Payable','liability','credit','NHIF deductions owed'),
  ('2120','NSSF Payable','liability','credit','NSSF deductions owed'),
  ('2200','Unearned Tuition','liability','credit','Fees paid in advance'),
  ('3000','Owner''s Equity','equity','credit','Sponsor / proprietor contribution'),
  ('3100','Retained Earnings','equity','credit','Accumulated surplus'),
  ('4000','Tuition Income','income','credit','Term fees earned'),
  ('4100','Transport Income','income','credit','Bus fees earned'),
  ('4200','Lunch Income','income','credit','Lunch programme'),
  ('4300','Boarding Income','income','credit','Boarding fees'),
  ('4900','Other Income','income','credit','Miscellaneous receipts'),
  ('5000','Salaries & Wages','expense','debit','Staff gross pay'),
  ('5010','Statutory — NHIF Employer','expense','debit','Employer NHIF contribution'),
  ('5020','Statutory — NSSF Employer','expense','debit','Employer NSSF contribution'),
  ('5100','Utilities','expense','debit','Power, water, internet'),
  ('5200','Repairs & Maintenance','expense','debit','Building and equipment upkeep'),
  ('5300','Transport — Fuel','expense','debit','Bus fuel and maintenance'),
  ('5400','Teaching Supplies','expense','debit','Books, stationery, lab consumables'),
  ('5500','Food & Catering','expense','debit','Lunch programme costs'),
  ('5900','Bank Charges','expense','debit','Bank and M-Pesa fees');

