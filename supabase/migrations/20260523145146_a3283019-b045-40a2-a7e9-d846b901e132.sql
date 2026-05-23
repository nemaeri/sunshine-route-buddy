
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS boarding boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lunch boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS home_address text,
  ADD COLUMN IF NOT EXISTS parent_name text,
  ADD COLUMN IF NOT EXISTS parent_phone text,
  ADD COLUMN IF NOT EXISTS parent_email text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
