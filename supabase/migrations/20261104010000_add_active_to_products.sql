ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE public.product_note_options
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

