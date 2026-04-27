-- Idempotent inventory deduction for completed/paid orders.
-- Safe to call multiple times: skips if a sale_deduction movement already exists for the order.

CREATE INDEX IF NOT EXISTS stock_movements_order_action_idx
  ON public.stock_movements (order_id, action)
  WHERE order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.process_inventory_deduction(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _branch_id uuid;
  _cashier_id uuid;
  _already_done boolean;
  _deduction_count int := 0;
  _skipped_count int := 0;
  _item record;
  _ingredient record;
  _deduct_qty numeric;
  _current_qty numeric;
  _new_qty numeric;
BEGIN
  -- 1. Validate order exists and fetch branch/cashier
  SELECT branch_id, cashier_id INTO _branch_id, _cashier_id
  FROM public.orders
  WHERE id = _order_id;

  IF _branch_id IS NULL THEN
    RETURN jsonb_build_object('error', 'order_not_found', 'order_id', _order_id);
  END IF;

  -- 2. Duplicate prevention: skip if any sale_deduction already exists for this order
  SELECT EXISTS (
    SELECT 1 FROM public.stock_movements
    WHERE order_id = _order_id AND action = 'sale_deduction'
  ) INTO _already_done;

  IF _already_done THEN
    RETURN jsonb_build_object(
      'status', 'skipped_duplicate',
      'order_id', _order_id,
      'deductions', 0
    );
  END IF;

  -- 3. Iterate order_items (skip soft-deleted)
  FOR _item IN
    SELECT id, menu_item_id, quantity
    FROM public.order_items
    WHERE order_id = _order_id
      AND deleted_at IS NULL
      AND menu_item_id IS NOT NULL
  LOOP
    -- Lookup recipe ingredients for this menu item
    FOR _ingredient IN
      SELECT ri.stock_item_id, ri.quantity_needed
      FROM public.recipe_ingredients ri
      WHERE ri.menu_item_id = _item.menu_item_id
    LOOP
      _deduct_qty := _ingredient.quantity_needed * _item.quantity;

      -- Multi-branch safety: only deduct stock that belongs to the order's branch
      SELECT quantity INTO _current_qty
      FROM public.stock_items
      WHERE id = _ingredient.stock_item_id
        AND branch_id = _branch_id;

      IF _current_qty IS NULL THEN
        _skipped_count := _skipped_count + 1;
        CONTINUE;
      END IF;

      _new_qty := GREATEST(0, _current_qty - _deduct_qty);

      UPDATE public.stock_items
      SET quantity = _new_qty,
          updated_at = now()
      WHERE id = _ingredient.stock_item_id
        AND branch_id = _branch_id;

      INSERT INTO public.stock_movements (
        stock_item_id, branch_id, staff_id, action, quantity, reason, order_id
      ) VALUES (
        _ingredient.stock_item_id,
        _branch_id,
        _cashier_id,
        'sale_deduction',
        _deduct_qty,
        'Order ' || _order_id::text,
        _order_id
      );

      _deduction_count := _deduction_count + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'ok',
    'order_id', _order_id,
    'branch_id', _branch_id,
    'deductions', _deduction_count,
    'skipped', _skipped_count
  );
END;
$$;

-- Grant execute to authenticated users (RBAC enforced upstream by payment creation policies)
GRANT EXECUTE ON FUNCTION public.process_inventory_deduction(uuid) TO authenticated;