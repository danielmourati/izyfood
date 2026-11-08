-- Migration: Add order_index and flavor limits (flavor_required, flavor_min, flavor_max) to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flavor_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flavor_min INTEGER NULL,
  ADD COLUMN IF NOT EXISTS flavor_max INTEGER NULL;

CREATE INDEX IF NOT EXISTS idx_products_order_index ON public.products(tenant_id, order_index);

