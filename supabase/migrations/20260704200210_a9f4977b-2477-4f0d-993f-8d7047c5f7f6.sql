ALTER TABLE public.attendant_permissions
  ADD COLUMN IF NOT EXISTS open_cash_register boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS close_cash_register boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS view_cash_register boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS view_reports boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS view_orders_history boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manage_deliveries boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manage_tables boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manage_coupons boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manage_suppliers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manage_printers boolean NOT NULL DEFAULT false;