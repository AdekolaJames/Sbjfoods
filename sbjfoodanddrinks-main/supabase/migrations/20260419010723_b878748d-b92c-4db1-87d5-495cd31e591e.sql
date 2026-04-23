-- 1) UNITS table (global, admin-managed)
CREATE TABLE IF NOT EXISTS public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  symbol text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active units"
  ON public.units FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage units"
  ON public.units FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_units_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed common units
INSERT INTO public.units (name, symbol) VALUES
  ('Piece', 'pc'),
  ('Kilogram', 'kg'),
  ('Gram', 'g'),
  ('Litre', 'l'),
  ('Millilitre', 'ml'),
  ('Pack', 'pack'),
  ('Bottle', 'btl'),
  ('Carton', 'ctn')
ON CONFLICT (name) DO NOTHING;

-- 2) Add sub-unit conversion to stock_items
ALTER TABLE public.stock_items
  ADD COLUMN IF NOT EXISTS base_unit text,
  ADD COLUMN IF NOT EXISTS sub_unit text,
  ADD COLUMN IF NOT EXISTS conversion_rate numeric NOT NULL DEFAULT 1;

-- Backfill base_unit from existing unit column
UPDATE public.stock_items SET base_unit = unit WHERE base_unit IS NULL;

-- 3) EXPENSES table
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  category text NOT NULL DEFAULT 'others',
  description text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid NOT NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_branch_date ON public.expenses(branch_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_active ON public.expenses(branch_id) WHERE deleted_at IS NULL;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all expenses"
  ON public.expenses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Branch managers manage own branch expenses"
  ON public.expenses FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'branch_manager'::app_role)
    AND branch_id = public.get_user_branch(auth.uid())
  );

CREATE POLICY "Branch staff view branch expenses"
  ON public.expenses FOR SELECT TO authenticated
  USING (branch_id = public.get_user_branch(auth.uid()));

CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();