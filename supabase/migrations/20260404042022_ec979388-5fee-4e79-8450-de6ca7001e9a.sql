ALTER TABLE public.store_tables DROP CONSTRAINT store_tables_number_key;
ALTER TABLE public.store_tables ADD CONSTRAINT store_tables_number_tenant_unique UNIQUE (number, tenant_id);