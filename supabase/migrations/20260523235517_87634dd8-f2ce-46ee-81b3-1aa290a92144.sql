
ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS paid_on date,
  ADD COLUMN IF NOT EXISTS paid_method text,
  ADD COLUMN IF NOT EXISTS paid_reference text,
  ADD COLUMN IF NOT EXISTS paid_amount numeric,
  ADD COLUMN IF NOT EXISTS paid_by uuid;

CREATE INDEX IF NOT EXISTS payslips_payroll_run_idx ON public.payslips(payroll_run_id);
CREATE INDEX IF NOT EXISTS payslips_paid_on_idx ON public.payslips(paid_on);
