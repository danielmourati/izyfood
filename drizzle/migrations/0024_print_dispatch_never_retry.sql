ALTER TABLE public.print_jobs ADD COLUMN dispatched_at timestamptz;
COMMENT ON COLUMN public.print_jobs.dispatched_at IS 'Server-confirmed physical transport boundary. Never automatically retry a dispatched job, including ambiguous transport failures.';
CREATE OR REPLACE FUNCTION public.guard_printed_job()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.dispatched_at IS NOT NULL THEN
    NEW.dispatched_at := OLD.dispatched_at;
    IF NEW.status IN ('pending', 'error') THEN
      NEW.status := 'done';
      NEW.printed_at := COALESCE(OLD.printed_at, clock_timestamp());
      NEW.printed_on := COALESCE(NEW.printed_on, 'envio sem confirmação');
    END IF;
  END IF;
  IF OLD.printed_at IS NOT NULL THEN
    NEW.status := 'done';
    NEW.printed_at := OLD.printed_at;
  END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.begin_print_job_dispatch(_job_id uuid, _device_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tenant uuid := public.get_user_tenant_id(); _n integer;
BEGIN
  IF auth.uid() IS NULL OR _tenant IS NULL THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  PERFORM 1 FROM public.print_hosts
  WHERE tenant_id = _tenant AND device_id = _device_id
    AND last_seen_at > clock_timestamp() - interval '45 seconds'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.print_jobs SET dispatched_at = clock_timestamp()
  WHERE id = _job_id AND tenant_id = _tenant AND status = 'printing'
    AND printed_at IS NULL AND dispatched_at IS NULL
    AND claimed_by LIKE '%(' || right(_device_id, 4) || ')';
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.begin_print_job_dispatch(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_print_job_dispatch(uuid, text) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.claim_print_job(_job_id uuid, _claimed_by text)
RETURNS SETOF public.print_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY UPDATE public.print_jobs
  SET status = 'printing', claimed_by = _claimed_by, claimed_at = now(), attempts = attempts + 1, error = NULL
  WHERE id = _job_id AND tenant_id = public.get_user_tenant_id()
    AND printed_at IS NULL AND dispatched_at IS NULL AND status IN ('pending', 'error')
  RETURNING *;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_print_job(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_print_job(uuid, text) TO service_role;