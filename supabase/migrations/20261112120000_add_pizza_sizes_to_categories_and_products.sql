-- Add pizza/calzone configuration columns to categories and products
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_pizza_category boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pizza_sizes jsonb DEFAULT NULL;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS pizza_sizes jsonb DEFAULT NULL;

