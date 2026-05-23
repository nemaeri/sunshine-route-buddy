
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
