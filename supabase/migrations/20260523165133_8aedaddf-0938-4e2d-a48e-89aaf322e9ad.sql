
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
