ALTER TABLE public.orders
  ADD COLUMN opened_by uuid,
  ADD COLUMN opened_by_name text;

COMMENT ON COLUMN public.orders.opened_by IS 'Authenticated user who originally opened the order.';
COMMENT ON COLUMN public.orders.opened_by_name IS 'Snapshot of the original attendant name for receipt printing.';