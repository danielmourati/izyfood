CREATE OR REPLACE FUNCTION public.get_print_host_state()
RETURNS TABLE(device_id text, label text, user_name text, last_seen_at timestamptz, age_ms bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT h.device_id, h.label, h.user_name, h.last_seen_at,
    (extract(epoch FROM (clock_timestamp() - h.last_seen_at)) * 1000)::bigint
  FROM public.print_hosts h
  WHERE h.tenant_id = public.get_user_tenant_id()
  ORDER BY h.last_seen_at DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_print_host_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_print_host_state() TO authenticated, service_role;