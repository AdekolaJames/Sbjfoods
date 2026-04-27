-- 1) Add new enum value for pending_approval
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pending_approval' BEFORE 'pending';

-- 2) Add new columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'pos',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_id uuid;

CREATE INDEX IF NOT EXISTS idx_orders_status_branch ON public.orders(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_source ON public.orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);

-- 3) Link customers to auth users (for shop login)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS email text;

CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);

-- 4) RLS: customers can view/manage their own customer record
DROP POLICY IF EXISTS "Customers view own record" ON public.customers;
CREATE POLICY "Customers view own record"
  ON public.customers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Customers update own record" ON public.customers;
CREATE POLICY "Customers update own record"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Customers create own record" ON public.customers;
CREATE POLICY "Customers create own record"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 5) RLS: customers can view their own orders by customer_id link
DROP POLICY IF EXISTS "Customers view own orders" ON public.orders;
CREATE POLICY "Customers view own orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM public.customers WHERE user_id = auth.uid()
    )
  );

-- 6) Trigger: auto-create customer record on auth signup if user metadata says role=customer
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'is_customer' = 'true' THEN
    INSERT INTO public.customers (user_id, name, phone, email, branch_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      COALESCE(NEW.raw_user_meta_data->>'phone', ''),
      NEW.email,
      NULLIF(NEW.raw_user_meta_data->>'branch_id', '')::uuid
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_customer_created ON auth.users;
CREATE TRIGGER on_auth_customer_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer();