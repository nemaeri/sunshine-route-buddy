
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
