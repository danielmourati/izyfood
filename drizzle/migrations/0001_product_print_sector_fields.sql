ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS search_code text,
  ADD COLUMN IF NOT EXISTS cost_price numeric,
  ADD COLUMN IF NOT EXISTS min_stock numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_fee_exempt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS print_sector text;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS print_sector text;
COMMENT ON COLUMN public.products.image IS 'DEPRECATED: product photos disabled';