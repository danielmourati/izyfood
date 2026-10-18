CREATE OR REPLACE FUNCTION public.claim_print_job(_job_id uuid, _claimed_by text)
 RETURNS SETOF print_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  UPDATE public.print_jobs
  SET status = 'printing', claimed_by = _claimed_by, claimed_at = now(), attempts = attempts + 1, error = NULL
  WHERE id = _job_id
    AND tenant_id = get_user_tenant_id()
    AND (status IN ('pending', 'error') OR (status = 'printing' AND claimed_at < now() - interval '60 seconds'))
  RETURNING *;
END;
$function$;

CREATE OR REPLACE FUNCTION public.purge_stale_failed_print_jobs()
 RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  DELETE FROM public.print_jobs j
  WHERE j.tenant_id = get_user_tenant_id()
    AND j.status IN ('error', 'pending', 'printing')
    AND j.kind = 'order'
    AND j.created_at < now() - interval '2 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id::text = j.payload->>'id' AND o.tenant_id = j.tenant_id
        AND o.status NOT IN ('finalizado', 'cancelado'));
$function$;

CREATE OR REPLACE FUNCTION public.force_print_jobs(_ids uuid[] DEFAULT NULL)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _n integer;
BEGIN
  PERFORM public.purge_stale_failed_print_jobs();
  UPDATE public.print_jobs
  SET status = 'pending', error = NULL, attempts = 0, claimed_by = NULL, claimed_at = NULL, updated_at = now()
  WHERE tenant_id = get_user_tenant_id()
    AND (_ids IS NULL OR id = ANY(_ids))
    AND (status IN ('pending', 'error') OR (status = 'printing' AND claimed_at < now() - interval '60 seconds'));
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.force_print_jobs(uuid[]) TO authenticated;