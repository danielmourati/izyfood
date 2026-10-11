CREATE OR REPLACE FUNCTION public.purge_stale_failed_print_jobs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.print_jobs j
  WHERE j.tenant_id = get_user_tenant_id()
    AND j.status = 'error'
    AND j.kind IN ('order', 'bill')
    AND NOT EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id::text = j.payload->>'id'
        AND o.tenant_id = j.tenant_id
        AND o.status NOT IN ('finalizado', 'cancelado')
    );
$$;
REVOKE ALL ON FUNCTION public.purge_stale_failed_print_jobs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_stale_failed_print_jobs() TO authenticated;