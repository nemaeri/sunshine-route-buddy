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