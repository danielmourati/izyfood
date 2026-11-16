-- Add business_types to tenants table
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS business_types TEXT[] DEFAULT '{}';

