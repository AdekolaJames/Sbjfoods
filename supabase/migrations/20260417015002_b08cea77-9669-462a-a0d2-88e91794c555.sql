
-- Soft delete fields for staff profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Soft delete for stock items
ALTER TABLE public.stock_items
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Settings table (singleton-style, branch-scoped)
CREATE TABLE IF NOT EXISTS public.business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID UNIQUE,
  business_name TEXT NOT NULL DEFAULT 'SBJ Foods & Drinks',
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  vat_percent NUMERIC NOT NULL DEFAULT 7.5,
  service_charge_percent NUMERIC NOT NULL DEFAULT 0,
  receipt_footer TEXT DEFAULT 'Thank you for dining with us!',
  enable_cash BOOLEAN NOT NULL DEFAULT true,
  enable_transfer BOOLEAN NOT NULL DEFAULT true,
  enable_pos BOOLEAN NOT NULL DEFAULT true,
  currency TEXT NOT NULL DEFAULT 'NGN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view settings"
  ON public.business_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage settings"
  ON public.business_settings FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_settings_updated
  BEFORE UPDATE ON public.business_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit log table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  branch_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

-- Update get_user_branch to ignore soft-deleted profiles
CREATE OR REPLACE FUNCTION public.get_user_branch(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT branch_id FROM public.profiles
  WHERE user_id = _user_id AND deleted_at IS NULL
  LIMIT 1
$$;

-- Allow staff page to fetch branches for assignment list (admin-only via RLS already)
-- Add a policy that lets a user see branches of their assignments (already exists via Staff can view their own branch)

-- Add policy: anyone authenticated can view branches they are assigned to
DROP POLICY IF EXISTS "Users view assigned branches" ON public.branches;
CREATE POLICY "Users view assigned branches"
  ON public.branches FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT branch_id FROM public.staff_branch_assignments WHERE user_id = auth.uid())
  );

-- Insert default settings row if none
INSERT INTO public.business_settings (branch_id, business_name)
SELECT NULL, 'SBJ Foods & Drinks'
WHERE NOT EXISTS (SELECT 1 FROM public.business_settings WHERE branch_id IS NULL);
