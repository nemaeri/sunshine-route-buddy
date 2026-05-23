
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
