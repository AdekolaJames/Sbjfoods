
-- 1. Helper: does the user have access to a given branch?
CREATE OR REPLACE FUNCTION public.user_can_access_branch(_user_id uuid, _branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _branch_id IS NOT NULL AND (
      public.has_role(_user_id, 'admin')
      OR EXISTS (
        SELECT 1 FROM public.staff_branch_assignments
        WHERE user_id = _user_id AND branch_id = _branch_id
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = _user_id AND branch_id = _branch_id AND deleted_at IS NULL
      )
    )
$$;

-- 2. ORDERS
DROP POLICY IF EXISTS "Branch staff view branch orders" ON public.orders;
CREATE POLICY "Branch staff view branch orders"
ON public.orders FOR SELECT TO authenticated
USING (public.user_can_access_branch(auth.uid(), branch_id));

DROP POLICY IF EXISTS "Cashiers create orders" ON public.orders;
CREATE POLICY "Cashiers create orders"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'cashier') OR public.has_role(auth.uid(), 'waiter'))
  AND public.user_can_access_branch(auth.uid(), branch_id)
  AND cashier_id = auth.uid()
);

DROP POLICY IF EXISTS "Cashiers update own branch orders" ON public.orders;
CREATE POLICY "Cashiers update own branch orders"
ON public.orders FOR UPDATE TO authenticated
USING (
  (public.has_role(auth.uid(), 'cashier')
    OR public.has_role(auth.uid(), 'waiter')
    OR public.has_role(auth.uid(), 'kitchen')
    OR public.has_role(auth.uid(), 'branch_manager'))
  AND public.user_can_access_branch(auth.uid(), branch_id)
);

-- 3. ORDER ITEMS
DROP POLICY IF EXISTS "Branch staff view order items" ON public.order_items;
CREATE POLICY "Branch staff view order items"
ON public.order_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o
  WHERE o.id = order_items.order_id
    AND public.user_can_access_branch(auth.uid(), o.branch_id)
));

DROP POLICY IF EXISTS "Cashiers create order items" ON public.order_items;
CREATE POLICY "Cashiers create order items"
ON public.order_items FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.orders o
  WHERE o.id = order_items.order_id
    AND public.user_can_access_branch(auth.uid(), o.branch_id)
    AND (public.has_role(auth.uid(), 'cashier') OR public.has_role(auth.uid(), 'waiter'))
));

DROP POLICY IF EXISTS "Staff update order items" ON public.order_items;
CREATE POLICY "Staff update order items"
ON public.order_items FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o
  WHERE o.id = order_items.order_id
    AND public.user_can_access_branch(auth.uid(), o.branch_id)
));

-- 4. ORDER ITEM ADDONS
DROP POLICY IF EXISTS "Branch staff view order addons" ON public.order_item_addons;
CREATE POLICY "Branch staff view order addons"
ON public.order_item_addons FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.id = order_item_addons.order_item_id
    AND public.user_can_access_branch(auth.uid(), o.branch_id)
));

DROP POLICY IF EXISTS "Cashiers create order addons" ON public.order_item_addons;
CREATE POLICY "Cashiers create order addons"
ON public.order_item_addons FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.id = order_item_addons.order_item_id
    AND public.user_can_access_branch(auth.uid(), o.branch_id)
));

-- 5. PAYMENTS
DROP POLICY IF EXISTS "Branch staff view payments" ON public.payments;
CREATE POLICY "Branch staff view payments"
ON public.payments FOR SELECT TO authenticated
USING (public.user_can_access_branch(auth.uid(), branch_id));

DROP POLICY IF EXISTS "Cashiers create payments" ON public.payments;
CREATE POLICY "Cashiers create payments"
ON public.payments FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'cashier')
  AND public.user_can_access_branch(auth.uid(), branch_id)
  AND staff_id = auth.uid()
);

-- 6. MENU ITEMS
DROP POLICY IF EXISTS "Staff view branch items" ON public.menu_items;
CREATE POLICY "Staff view branch items"
ON public.menu_items FOR SELECT TO authenticated
USING (public.user_can_access_branch(auth.uid(), branch_id));

DROP POLICY IF EXISTS "Branch managers manage own branch items" ON public.menu_items;
CREATE POLICY "Branch managers manage own branch items"
ON public.menu_items FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'branch_manager') AND public.user_can_access_branch(auth.uid(), branch_id))
WITH CHECK (public.has_role(auth.uid(), 'branch_manager') AND public.user_can_access_branch(auth.uid(), branch_id));

-- 7. MENU CATEGORIES
DROP POLICY IF EXISTS "Staff view active categories" ON public.menu_categories;
CREATE POLICY "Staff view active categories"
ON public.menu_categories FOR SELECT TO authenticated
USING (
  is_active = true AND (
    branch_id IS NULL OR public.user_can_access_branch(auth.uid(), branch_id)
  )
);

DROP POLICY IF EXISTS "Branch managers manage own branch categories" ON public.menu_categories;
CREATE POLICY "Branch managers manage own branch categories"
ON public.menu_categories FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'branch_manager')
  AND (branch_id IS NULL OR public.user_can_access_branch(auth.uid(), branch_id))
)
WITH CHECK (
  public.has_role(auth.uid(), 'branch_manager')
  AND (branch_id IS NULL OR public.user_can_access_branch(auth.uid(), branch_id))
);

-- 8. MENU ITEM ADDONS
DROP POLICY IF EXISTS "Staff view branch addons" ON public.menu_item_addons;
CREATE POLICY "Staff view branch addons"
ON public.menu_item_addons FOR SELECT TO authenticated
USING (public.user_can_access_branch(auth.uid(), branch_id));

DROP POLICY IF EXISTS "Branch managers manage own addons" ON public.menu_item_addons;
CREATE POLICY "Branch managers manage own addons"
ON public.menu_item_addons FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'branch_manager') AND public.user_can_access_branch(auth.uid(), branch_id))
WITH CHECK (public.has_role(auth.uid(), 'branch_manager') AND public.user_can_access_branch(auth.uid(), branch_id));

-- 9. STOCK ITEMS
DROP POLICY IF EXISTS "Staff view branch stock" ON public.stock_items;
CREATE POLICY "Staff view branch stock"
ON public.stock_items FOR SELECT TO authenticated
USING (public.user_can_access_branch(auth.uid(), branch_id));

DROP POLICY IF EXISTS "Branch managers manage own stock" ON public.stock_items;
CREATE POLICY "Branch managers manage own stock"
ON public.stock_items FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'branch_manager') AND public.user_can_access_branch(auth.uid(), branch_id))
WITH CHECK (public.has_role(auth.uid(), 'branch_manager') AND public.user_can_access_branch(auth.uid(), branch_id));

-- 10. STOCK MOVEMENTS
DROP POLICY IF EXISTS "Staff view branch movements" ON public.stock_movements;
CREATE POLICY "Staff view branch movements"
ON public.stock_movements FOR SELECT TO authenticated
USING (public.user_can_access_branch(auth.uid(), branch_id));

DROP POLICY IF EXISTS "Branch managers manage own movements" ON public.stock_movements;
CREATE POLICY "Branch managers manage own movements"
ON public.stock_movements FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'branch_manager') AND public.user_can_access_branch(auth.uid(), branch_id))
WITH CHECK (public.has_role(auth.uid(), 'branch_manager') AND public.user_can_access_branch(auth.uid(), branch_id));

-- 11. STOCK PURCHASES
DROP POLICY IF EXISTS "Branch staff view branch purchases" ON public.stock_purchases;
CREATE POLICY "Branch staff view branch purchases"
ON public.stock_purchases FOR SELECT TO authenticated
USING (public.user_can_access_branch(auth.uid(), branch_id));

DROP POLICY IF EXISTS "Branch managers manage own purchases" ON public.stock_purchases;
CREATE POLICY "Branch managers manage own purchases"
ON public.stock_purchases FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'branch_manager') AND public.user_can_access_branch(auth.uid(), branch_id))
WITH CHECK (public.has_role(auth.uid(), 'branch_manager') AND public.user_can_access_branch(auth.uid(), branch_id));

-- 12. CUSTOMERS
DROP POLICY IF EXISTS "Staff view branch customers" ON public.customers;
CREATE POLICY "Staff view branch customers"
ON public.customers FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (branch_id IS NOT NULL AND public.user_can_access_branch(auth.uid(), branch_id))
);

DROP POLICY IF EXISTS "Staff create customers" ON public.customers;
CREATE POLICY "Staff create customers"
ON public.customers FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (branch_id IS NOT NULL AND public.user_can_access_branch(auth.uid(), branch_id))
);

-- 13. EXPENSES
DROP POLICY IF EXISTS "Branch staff view branch expenses" ON public.expenses;
CREATE POLICY "Branch staff view branch expenses"
ON public.expenses FOR SELECT TO authenticated
USING (public.user_can_access_branch(auth.uid(), branch_id));

DROP POLICY IF EXISTS "Branch managers manage own branch expenses" ON public.expenses;
CREATE POLICY "Branch managers manage own branch expenses"
ON public.expenses FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'branch_manager') AND public.user_can_access_branch(auth.uid(), branch_id))
WITH CHECK (public.has_role(auth.uid(), 'branch_manager') AND public.user_can_access_branch(auth.uid(), branch_id));

-- 14. RESTAURANT TABLES (kept for backward compat)
DROP POLICY IF EXISTS "Branch staff view branch tables" ON public.restaurant_tables;
CREATE POLICY "Branch staff view branch tables"
ON public.restaurant_tables FOR SELECT TO authenticated
USING (public.user_can_access_branch(auth.uid(), branch_id));

DROP POLICY IF EXISTS "Waiters update branch tables" ON public.restaurant_tables;
CREATE POLICY "Waiters update branch tables"
ON public.restaurant_tables FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'waiter') AND public.user_can_access_branch(auth.uid(), branch_id));

-- 15. PROFILES (branch managers see staff in any of their branches)
DROP POLICY IF EXISTS "Branch managers can view branch staff" ON public.profiles;
CREATE POLICY "Branch managers can view branch staff"
ON public.profiles FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'branch_manager')
  AND branch_id IS NOT NULL
  AND public.user_can_access_branch(auth.uid(), branch_id)
);

-- 16. BRANCHES (staff see any branch they're assigned to)
DROP POLICY IF EXISTS "Staff can view their own branch" ON public.branches;
CREATE POLICY "Staff can view their own branch"
ON public.branches FOR SELECT TO authenticated
USING (public.user_can_access_branch(auth.uid(), id));

-- 17. STAFF BRANCH ASSIGNMENTS (managers see assignments in any branch they manage)
DROP POLICY IF EXISTS "Branch managers view branch assignments" ON public.staff_branch_assignments;
CREATE POLICY "Branch managers view branch assignments"
ON public.staff_branch_assignments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'branch_manager')
  AND public.user_can_access_branch(auth.uid(), branch_id)
);

-- 18. NOTIFICATION SETTINGS
DROP POLICY IF EXISTS "Branch managers view branch notif settings" ON public.notification_settings;
CREATE POLICY "Branch managers view branch notif settings"
ON public.notification_settings FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'branch_manager')
  AND branch_id IS NOT NULL
  AND public.user_can_access_branch(auth.uid(), branch_id)
);
