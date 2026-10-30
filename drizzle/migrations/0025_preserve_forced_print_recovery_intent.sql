CREATE OR REPLACE FUNCTION public.force_print_jobs(_ids uuid[] DEFAULT NULL::uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  PERFORM public.purge_stale_failed_print_jobs();
  PERFORM public.finalize_stale_printing_jobs();
  UPDATE public.print_jobs
  SET status = 'pending', error = NULL, attempts = GREATEST(attempts, 1), claimed_by = NULL, claimed_at = NULL, updated_at = now()
  WHERE tenant_id = public.get_user_tenant_id() AND printed_at IS NULL AND dispatched_at IS NULL
    AND (_ids IS NULL OR id = ANY(_ids))
    AND (status = 'error' OR (status = 'pending' AND updated_at < now() - interval '5 seconds'));
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;
REVOKE ALL ON FUNCTION public.force_print_jobs(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.force_print_jobs(uuid[]) TO authenticated, service_role;