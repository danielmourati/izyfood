CREATE INDEX IF NOT EXISTS sales_tenant_date_id_idx ON public.sales (tenant_id, date DESC, id DESC);
CREATE INDEX IF NOT EXISTS orders_tenant_created_id_idx ON public.orders (tenant_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS orders_active_tenant_created_idx ON public.orders (tenant_id, created_at DESC, id DESC) WHERE status IN ('aberto', 'segurado', 'pronto');
CREATE OR REPLACE FUNCTION public.sales_total() RETURNS numeric LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT coalesce(sum(total), 0) FROM public.sales WHERE tenant_id = public.get_user_tenant_id() $$;
REVOKE ALL ON FUNCTION public.sales_total() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sales_total() TO authenticated, service_role;