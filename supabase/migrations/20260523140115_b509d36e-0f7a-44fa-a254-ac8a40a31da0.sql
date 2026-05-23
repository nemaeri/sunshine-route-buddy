
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
