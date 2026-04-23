-- Ensure offline_id uniqueness for duplicate prevention during sync.
-- Partial unique index: only enforced when offline_id is set.
CREATE UNIQUE INDEX IF NOT EXISTS orders_offline_id_unique
  ON public.orders (offline_id)
  WHERE offline_id IS NOT NULL;

-- Helpful index for lookup during sync
CREATE INDEX IF NOT EXISTS orders_branch_status_idx
  ON public.orders (branch_id, status);