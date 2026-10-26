CREATE OR REPLACE FUNCTION public.finalize_stale_printing_jobs()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _n integer;
BEGIN
  UPDATE public.print_jobs
  SET status = 'done', printed_at = now(), error = NULL, printed_on = COALESCE(printed_on, 'provável'), updated_at = now()
  WHERE tenant_id = get_user_tenant_id() AND printed_at IS NULL
    AND status = 'printing' AND claimed_at < now() - interval '60 seconds';
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.finalize_stale_printing_jobs() TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_print_job(_job_id uuid, _claimed_by text)
 RETURNS SETOF print_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  UPDATE public.print_jobs
  SET status = 'printing', claimed_by = _claimed_by, claimed_at = now(), attempts = attempts + 1, error = NULL
  WHERE id = _job_id AND tenant_id = get_user_tenant_id() AND printed_at IS NULL
    AND status IN ('pending', 'error')
  RETURNING *;
END;
$function$;

CREATE OR REPLACE FUNCTION public.force_print_jobs(_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _n integer;
BEGIN
  PERFORM public.purge_stale_failed_print_jobs();
  PERFORM public.finalize_stale_printing_jobs();
  UPDATE public.print_jobs
  SET status = 'pending', error = NULL, attempts = 0, claimed_by = NULL, claimed_at = NULL, updated_at = now()
  WHERE tenant_id = get_user_tenant_id() AND printed_at IS NULL
    AND (_ids IS NULL OR id = ANY(_ids))
    AND (status = 'error' OR (status = 'pending' AND updated_at < now() - interval '5 seconds'));
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$function$;