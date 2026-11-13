-- Add is_pizza_flavor and is_combo flags to products for Pizza/Calzone role classification
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_pizza_flavor BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_combo BOOLEAN DEFAULT FALSE;

