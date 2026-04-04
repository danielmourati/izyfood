
-- Add service fee percentage to store settings
ALTER TABLE public.store_settings
ADD COLUMN service_fee_percentage numeric NOT NULL DEFAULT 0;

-- Add service fee amount to orders (applied only to mesa orders)
ALTER TABLE public.orders
ADD COLUMN service_fee numeric NULL DEFAULT NULL;

-- Add commission percentage to tenant members (for attendants)
ALTER TABLE public.tenant_members
ADD COLUMN commission_percentage numeric NOT NULL DEFAULT 0;
