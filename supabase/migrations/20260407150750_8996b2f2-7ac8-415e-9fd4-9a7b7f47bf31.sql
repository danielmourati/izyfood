ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS login_icon text,
  ADD COLUMN IF NOT EXISTS login_carousel_images jsonb DEFAULT '[]'::jsonb;