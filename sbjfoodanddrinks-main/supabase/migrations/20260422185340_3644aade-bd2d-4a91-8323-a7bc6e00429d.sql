-- Preview-only RPC for System Reset: returns counts WITHOUT deleting anything.
-- Admin-only, security definer, read-only.

CREATE OR REPLACE FUNCTION public.system_reset_preview(
  _scope_orders boolean DEFAULT false,
  _scope_payments boolean DEFAULT false,
  _scope_movements boolean DEFAULT false,
  _reset_stock_qty boolean DEFAULT false,
  _branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _orders_count int := 0;
  _order_items_count int := 0;
  _payments_count int := 0;
  _movements_count int := 0;
  _stock_items_count int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can preview system reset';
  END IF;

  IF _scope_orders THEN
    SELECT COUNT(*) INTO _orders_count
    FROM public.orders
    WHERE deleted_at IS NULL
      AND (_branch_id IS NULL OR branch_id = _branch_id);

    SELECT COUNT(*) INTO _order_items_count
    FROM public.order_items oi
    WHERE oi.deleted_at IS NULL
      AND oi.order_id IN (
        SELECT id FROM public.orders
        WHERE deleted_at IS NULL
          AND (_branch_id IS NULL OR branch_id = _branch_id)
      );
  END IF;

  IF _scope_payments THEN
    SELECT COUNT(*) INTO _payments_count
    FROM public.payments
    WHERE deleted_at IS NULL
      AND (_branch_id IS NULL OR branch_id = _branch_id);
  END IF;

  IF _scope_movements THEN
    SELECT COUNT(*) INTO _movements_count
    FROM public.stock_movements
    WHERE deleted_at IS NULL
      AND (_branch_id IS NULL OR branch_id = _branch_id);
  END IF;

  IF _reset_stock_qty THEN
    SELECT COUNT(*) INTO _stock_items_count
    FROM public.stock_items
    WHERE _branch_id IS NULL OR branch_id = _branch_id;
  END IF;

  RETURN jsonb_build_object(
    'orders', _orders_count,
    'order_items', _order_items_count,
    'payments', _payments_count,
    'movements', _movements_count,
    'stock_items_to_zero', _stock_items_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.system_reset_preview(boolean, boolean, boolean, boolean, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.system_reset_preview(boolean, boolean, boolean, boolean, uuid) TO authenticated;