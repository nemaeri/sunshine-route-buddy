
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
