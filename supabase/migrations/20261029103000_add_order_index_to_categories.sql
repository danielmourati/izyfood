-- Migration: Add order_index column to categories table for custom ordering
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Optional index to speed up tenant category ordering
CREATE INDEX IF NOT EXISTS idx_categories_order_index ON public.categories(tenant_id, order_index);
