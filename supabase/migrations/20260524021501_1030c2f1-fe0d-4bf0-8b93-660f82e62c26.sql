
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
