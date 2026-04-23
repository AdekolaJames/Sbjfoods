
-- =========================================
-- 1. STOCK PURCHASES (WAC) SYSTEM
-- =========================================
CREATE TABLE IF NOT EXISTS public.stock_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL,
  quantity_added numeric NOT NULL CHECK (quantity_added > 0),
  unit_cost numeric NOT NULL CHECK (unit_cost >= 0),
  total_cost numeric NOT NULL DEFAULT 0,
  supplier text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS average_cost numeric NOT NULL DEFAULT 0;

ALTER TABLE public.stock_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all stock purchases" ON public.stock_purchases
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch managers manage own purchases" ON public.stock_purchases
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'branch_manager') AND branch_id = public.get_user_branch(auth.uid()));

CREATE POLICY "Branch staff view branch purchases" ON public.stock_purchases
  FOR SELECT TO authenticated
  USING (branch_id = public.get_user_branch(auth.uid()));

-- Trigger: when a purchase is inserted, recompute WAC + bump qty + log movement
CREATE OR REPLACE FUNCTION public.handle_stock_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _old_qty numeric;
  _old_avg numeric;
  _new_qty numeric;
  _new_avg numeric;
BEGIN
  NEW.total_cost := NEW.quantity_added * NEW.unit_cost;

  SELECT COALESCE(quantity, 0), COALESCE(average_cost, 0)
    INTO _old_qty, _old_avg
  FROM public.stock_items WHERE id = NEW.stock_item_id;

  _new_qty := _old_qty + NEW.quantity_added;
  IF _new_qty > 0 THEN
    _new_avg := ((_old_qty * _old_avg) + (NEW.quantity_added * NEW.unit_cost)) / _new_qty;
  ELSE
    _new_avg := NEW.unit_cost;
  END IF;

  UPDATE public.stock_items
    SET quantity = _new_qty,
        average_cost = _new_avg,
        unit_cost = _new_avg,  -- keep legacy column synced for backward compat
        updated_at = now()
  WHERE id = NEW.stock_item_id;

  INSERT INTO public.stock_movements (stock_item_id, branch_id, staff_id, action, quantity, reason)
  VALUES (NEW.stock_item_id, NEW.branch_id, NEW.created_by, 'purchase', NEW.quantity_added,
          COALESCE('Purchase: ' || NEW.supplier, 'Stock purchase'));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_purchase ON public.stock_purchases;
CREATE TRIGGER trg_stock_purchase
  BEFORE INSERT ON public.stock_purchases
  FOR EACH ROW EXECUTE FUNCTION public.handle_stock_purchase();

-- =========================================
-- 2. ROLE PERMISSIONS
-- =========================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name public.app_role NOT NULL,
  permission_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_name, permission_key)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage role permissions" ON public.role_permissions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read role permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

-- Helper to check a permission for a user (admin always true)
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.role_permissions rp
      JOIN public.user_roles ur ON ur.role = rp.role_name
      WHERE ur.user_id = _user_id
        AND rp.permission_key = _permission
        AND rp.is_enabled = true
    )
$$;

-- Seed default permissions
INSERT INTO public.role_permissions (role_name, permission_key, is_enabled) VALUES
  -- Admin (all true; admin override means these don't really matter but kept for UI)
  ('admin','create_order',true),('admin','edit_order',true),('admin','cancel_order',true),
  ('admin','apply_discount',true),('admin','split_payment',true),
  ('admin','view_orders',true),('admin','update_order_status',true),
  ('admin','view_inventory',true),('admin','add_stock',true),('admin','edit_stock',true),('admin','delete_stock',true),
  ('admin','create_menu',true),('admin','edit_menu',true),('admin','delete_menu',true),
  ('admin','create_staff',true),('admin','edit_staff',true),('admin','delete_staff',true),
  ('admin','view_reports',true),('admin','view_profit_loss',true),('admin','access_settings',true),
  -- Branch Manager
  ('branch_manager','create_order',true),('branch_manager','edit_order',true),('branch_manager','cancel_order',true),
  ('branch_manager','apply_discount',true),('branch_manager','split_payment',true),
  ('branch_manager','view_orders',true),('branch_manager','update_order_status',true),
  ('branch_manager','view_inventory',true),('branch_manager','add_stock',true),('branch_manager','edit_stock',false),('branch_manager','delete_stock',false),
  ('branch_manager','create_menu',false),('branch_manager','edit_menu',true),('branch_manager','delete_menu',false),
  ('branch_manager','create_staff',false),('branch_manager','edit_staff',false),('branch_manager','delete_staff',false),
  ('branch_manager','view_reports',true),('branch_manager','view_profit_loss',true),('branch_manager','access_settings',false),
  -- Cashier
  ('cashier','create_order',true),('cashier','edit_order',true),('cashier','cancel_order',false),
  ('cashier','apply_discount',true),('cashier','split_payment',true),
  ('cashier','view_orders',true),('cashier','update_order_status',false),
  ('cashier','view_inventory',true),('cashier','add_stock',false),('cashier','edit_stock',false),('cashier','delete_stock',false),
  ('cashier','create_menu',false),('cashier','edit_menu',false),('cashier','delete_menu',false),
  ('cashier','create_staff',false),('cashier','edit_staff',false),('cashier','delete_staff',false),
  ('cashier','view_reports',false),('cashier','view_profit_loss',false),('cashier','access_settings',false),
  -- Kitchen
  ('kitchen','create_order',false),('kitchen','edit_order',false),('kitchen','cancel_order',false),
  ('kitchen','apply_discount',false),('kitchen','split_payment',false),
  ('kitchen','view_orders',true),('kitchen','update_order_status',true),
  ('kitchen','view_inventory',false),('kitchen','add_stock',false),('kitchen','edit_stock',false),('kitchen','delete_stock',false),
  ('kitchen','create_menu',false),('kitchen','edit_menu',false),('kitchen','delete_menu',false),
  ('kitchen','create_staff',false),('kitchen','edit_staff',false),('kitchen','delete_staff',false),
  ('kitchen','view_reports',false),('kitchen','view_profit_loss',false),('kitchen','access_settings',false),
  -- Waiter
  ('waiter','create_order',true),('waiter','edit_order',true),('waiter','cancel_order',false),
  ('waiter','apply_discount',false),('waiter','split_payment',false),
  ('waiter','view_orders',true),('waiter','update_order_status',true),
  ('waiter','view_inventory',false),('waiter','add_stock',false),('waiter','edit_stock',false),('waiter','delete_stock',false),
  ('waiter','create_menu',false),('waiter','edit_menu',false),('waiter','delete_menu',false),
  ('waiter','create_staff',false),('waiter','edit_staff',false),('waiter','delete_staff',false),
  ('waiter','view_reports',false),('waiter','view_profit_loss',false),('waiter','access_settings',false)
ON CONFLICT (role_name, permission_key) DO NOTHING;

-- =========================================
-- 3. ORDERS — offline_id for dedup
-- =========================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS offline_id text;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_orders_offline_id
  ON public.orders(offline_id) WHERE offline_id IS NOT NULL;

-- =========================================
-- 4. CUSTOMERS — aggregates + uniqueness
-- =========================================
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_orders integer NOT NULL DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_spent numeric NOT NULL DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_order_date timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_customers_phone_branch
  ON public.customers(phone, branch_id) WHERE phone IS NOT NULL AND phone <> '';

-- Trigger to bump aggregates when an order linked to customer becomes paid
CREATE OR REPLACE FUNCTION public.update_customer_aggregates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL
     AND NEW.payment_status = 'paid'
     AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM 'paid') THEN
    UPDATE public.customers
      SET total_orders = total_orders + 1,
          total_spent = total_spent + COALESCE(NEW.total, 0),
          last_order_date = COALESCE(NEW.updated_at, now())
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_customer_aggregates ON public.orders;
CREATE TRIGGER trg_update_customer_aggregates
  AFTER INSERT OR UPDATE OF payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_customer_aggregates();

-- =========================================
-- 5. BRANCHES RLS — fix "Unknown Branch"
-- (Policy already exists per current schema; ensure it's there idempotently)
-- =========================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='branches' AND policyname='Users view assigned branches'
  ) THEN
    EXECUTE $POL$
      CREATE POLICY "Users view assigned branches" ON public.branches
      FOR SELECT TO authenticated
      USING (id IN (SELECT branch_id FROM public.staff_branch_assignments WHERE user_id = auth.uid()))
    $POL$;
  END IF;
END $$;
