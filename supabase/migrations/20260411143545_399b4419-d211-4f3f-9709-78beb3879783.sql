
-- ============================================
-- MENU CATEGORIES
-- ============================================
CREATE TABLE public.menu_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all categories" ON public.menu_categories FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch managers manage own branch categories" ON public.menu_categories FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'branch_manager') AND (branch_id = get_user_branch(auth.uid()) OR branch_id IS NULL));

CREATE POLICY "Staff view active categories" ON public.menu_categories FOR SELECT TO authenticated
  USING (is_active = true AND (branch_id = get_user_branch(auth.uid()) OR branch_id IS NULL));

CREATE TRIGGER update_menu_categories_updated_at BEFORE UPDATE ON public.menu_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MENU ITEMS
-- ============================================
CREATE TABLE public.menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  description TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  prep_time INTEGER,
  display_order INTEGER NOT NULL DEFAULT 0,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all menu items" ON public.menu_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch managers manage own branch items" ON public.menu_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'branch_manager') AND branch_id = get_user_branch(auth.uid()));

CREATE POLICY "Staff view branch items" ON public.menu_items FOR SELECT TO authenticated
  USING (branch_id = get_user_branch(auth.uid()));

CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MENU ITEM ADD-ONS
-- ============================================
CREATE TABLE public.menu_item_addons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  category TEXT DEFAULT 'general',
  is_available BOOLEAN NOT NULL DEFAULT true,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_item_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all addons" ON public.menu_item_addons FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch managers manage own addons" ON public.menu_item_addons FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'branch_manager') AND branch_id = get_user_branch(auth.uid()));

CREATE POLICY "Staff view branch addons" ON public.menu_item_addons FOR SELECT TO authenticated
  USING (branch_id = get_user_branch(auth.uid()));

CREATE TRIGGER update_menu_item_addons_updated_at BEFORE UPDATE ON public.menu_item_addons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RESTAURANT TABLES
-- ============================================
CREATE TABLE public.restaurant_tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_number TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'maintenance')),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(table_number, branch_id)
);

ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all tables" ON public.restaurant_tables FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch staff view branch tables" ON public.restaurant_tables FOR SELECT TO authenticated
  USING (branch_id = get_user_branch(auth.uid()));

CREATE POLICY "Waiters update branch tables" ON public.restaurant_tables FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'waiter') AND branch_id = get_user_branch(auth.uid()));

CREATE TRIGGER update_restaurant_tables_updated_at BEFORE UPDATE ON public.restaurant_tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ORDERS
-- ============================================
CREATE TYPE public.order_type AS ENUM ('dine_in', 'takeaway', 'delivery');
CREATE TYPE public.order_status AS ENUM ('pending', 'sent_to_kitchen', 'preparing', 'ready', 'served', 'completed', 'cancelled');
CREATE TYPE public.payment_status AS ENUM ('unpaid', 'partial', 'paid', 'refunded');

CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL,
  order_type order_type NOT NULL DEFAULT 'takeaway',
  status order_status NOT NULL DEFAULT 'pending',
  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_type TEXT CHECK (discount_type IN ('fixed', 'percentage', 'staff_meal', NULL)),
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  notes TEXT,
  table_id UUID REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  cashier_id UUID NOT NULL,
  is_held BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all orders" ON public.orders FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch staff view branch orders" ON public.orders FOR SELECT TO authenticated
  USING (branch_id = get_user_branch(auth.uid()));

CREATE POLICY "Cashiers create orders" ON public.orders FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'cashier') OR has_role(auth.uid(), 'waiter')) AND branch_id = get_user_branch(auth.uid()) AND cashier_id = auth.uid());

CREATE POLICY "Cashiers update own branch orders" ON public.orders FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'cashier') OR has_role(auth.uid(), 'waiter') OR has_role(auth.uid(), 'kitchen') OR has_role(auth.uid(), 'branch_manager')) AND branch_id = get_user_branch(auth.uid()));

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- ============================================
-- ORDER ITEMS
-- ============================================
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all order items" ON public.order_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch staff view order items" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.branch_id = get_user_branch(auth.uid())));

CREATE POLICY "Cashiers create order items" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.branch_id = get_user_branch(auth.uid()) AND (has_role(auth.uid(), 'cashier') OR has_role(auth.uid(), 'waiter'))));

CREATE POLICY "Staff update order items" ON public.order_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.branch_id = get_user_branch(auth.uid())));

-- ============================================
-- ORDER ITEM ADD-ONS
-- ============================================
CREATE TABLE public.order_item_addons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE CASCADE NOT NULL,
  addon_id UUID REFERENCES public.menu_item_addons(id) ON DELETE SET NULL,
  addon_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_item_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all order addons" ON public.order_item_addons FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch staff view order addons" ON public.order_item_addons FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id WHERE oi.id = order_item_id AND o.branch_id = get_user_branch(auth.uid())));

CREATE POLICY "Cashiers create order addons" ON public.order_item_addons FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id WHERE oi.id = order_item_id AND o.branch_id = get_user_branch(auth.uid())));

-- ============================================
-- PAYMENTS
-- ============================================
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('cash', 'bank_transfer', 'pos_card', 'online')),
  amount NUMERIC(12,2) NOT NULL,
  reference TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  staff_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all payments" ON public.payments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch staff view payments" ON public.payments FOR SELECT TO authenticated
  USING (branch_id = get_user_branch(auth.uid()));

CREATE POLICY "Cashiers create payments" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'cashier') AND branch_id = get_user_branch(auth.uid()) AND staff_id = auth.uid());

-- ============================================
-- STOCK / INVENTORY
-- ============================================
CREATE TABLE public.stock_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pc',
  unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC(12,3) NOT NULL DEFAULT 5,
  supplier TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all stock" ON public.stock_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch managers manage own stock" ON public.stock_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'branch_manager') AND branch_id = get_user_branch(auth.uid()));

CREATE POLICY "Staff view branch stock" ON public.stock_items FOR SELECT TO authenticated
  USING (branch_id = get_user_branch(auth.uid()));

CREATE TRIGGER update_stock_items_updated_at BEFORE UPDATE ON public.stock_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RECIPE INGREDIENTS (menu item → stock mapping)
-- ============================================
CREATE TABLE public.recipe_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE CASCADE NOT NULL,
  stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE CASCADE NOT NULL,
  quantity_needed NUMERIC(10,3) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pc',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage recipes" ON public.recipe_ingredients FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch managers view recipes" ON public.recipe_ingredients FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'branch_manager'));

-- ============================================
-- STOCK MOVEMENTS
-- ============================================
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('stock_in', 'stock_out', 'sale_deduction', 'adjustment', 'waste', 'addon_deduction')),
  quantity NUMERIC(12,3) NOT NULL,
  reason TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  staff_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all movements" ON public.stock_movements FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Branch managers manage own movements" ON public.stock_movements FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'branch_manager') AND branch_id = get_user_branch(auth.uid()));

CREATE POLICY "Staff view branch movements" ON public.stock_movements FOR SELECT TO authenticated
  USING (branch_id = get_user_branch(auth.uid()));

-- ============================================
-- ORDER NUMBER SEQUENCE FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_order_number(_branch_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count INTEGER;
  _date TEXT;
BEGIN
  _date := to_char(now(), 'YYMMDD');
  SELECT COUNT(*) + 1 INTO _count FROM public.orders WHERE order_number LIKE _branch_code || '-' || _date || '%';
  RETURN _branch_code || '-' || _date || '-' || lpad(_count::TEXT, 3, '0');
END;
$$;
