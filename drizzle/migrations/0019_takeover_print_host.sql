CREATE OR REPLACE FUNCTION public.takeover_print_host(_device_id text, _label text DEFAULT NULL, _user_name text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tenant uuid := public.get_user_tenant_id(); _prev jsonb;
BEGIN
  IF auth.uid() IS NULL OR _tenant IS NULL OR NOT public.is_tenant_admin(auth.uid()) THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  IF _device_id IS NULL OR length(_device_id) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Dispositivo inválido'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_tenant::text, 721));
  SELECT COALESCE(jsonb_agg(jsonb_build_object('aparelho', label, 'usuario', user_name)), '[]'::jsonb) INTO _prev
    FROM public.print_hosts WHERE tenant_id = _tenant AND device_id <> _device_id AND last_seen_at > clock_timestamp() - interval '45 seconds';
  DELETE FROM public.print_hosts WHERE tenant_id = _tenant AND device_id <> _device_id;
  INSERT INTO public.print_hosts(tenant_id, device_id, label, user_name, last_seen_at)
  VALUES (_tenant, _device_id, left(_label, 200), left(_user_name, 200), clock_timestamp())
  ON CONFLICT (tenant_id, device_id) DO UPDATE SET label = EXCLUDED.label, user_name = EXCLUDED.user_name, last_seen_at = EXCLUDED.last_seen_at;
  PERFORM public.log_audit_event('print_host_takeover', 'print_host', _device_id, jsonb_build_object('anterior', _prev, 'novo', _label));
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.takeover_print_host(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.takeover_print_host(text,text,text) TO authenticated, service_role;