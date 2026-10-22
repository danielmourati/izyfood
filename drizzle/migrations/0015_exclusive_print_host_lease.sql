CREATE OR REPLACE FUNCTION public.guard_single_print_host()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text, 721));
  IF EXISTS (SELECT 1 FROM public.print_hosts WHERE tenant_id = NEW.tenant_id AND device_id <> NEW.device_id AND last_seen_at > clock_timestamp() - interval '45 seconds') THEN
    RAISE EXCEPTION 'Já existe um Caixa de impressão ativo nesta loja.' USING ERRCODE = 'P0001';
  END IF;
  NEW.last_seen_at := clock_timestamp();
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_single_print_host BEFORE INSERT OR UPDATE ON public.print_hosts FOR EACH ROW EXECUTE FUNCTION public.guard_single_print_host();
CREATE OR REPLACE FUNCTION public.acquire_print_host(_device_id text, _label text DEFAULT NULL, _user_name text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tenant uuid := public.get_user_tenant_id();
BEGIN
  IF auth.uid() IS NULL OR _tenant IS NULL THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  IF _device_id IS NULL OR length(_device_id) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Dispositivo inválido'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_tenant::text, 721));
  IF EXISTS (SELECT 1 FROM public.print_hosts WHERE tenant_id = _tenant AND device_id <> _device_id AND last_seen_at > clock_timestamp() - interval '45 seconds') THEN RETURN false; END IF;
  INSERT INTO public.print_hosts(tenant_id, device_id, label, user_name, last_seen_at)
  VALUES (_tenant, _device_id, left(_label, 200), left(_user_name, 200), clock_timestamp())
  ON CONFLICT (tenant_id, device_id) DO UPDATE SET label = EXCLUDED.label, user_name = EXCLUDED.user_name, last_seen_at = EXCLUDED.last_seen_at;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.acquire_print_host(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acquire_print_host(text,text,text) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.claim_print_job_for_host(_job_id uuid, _device_id text, _claimed_by text)
RETURNS SETOF public.print_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tenant uuid := public.get_user_tenant_id();
BEGIN
  IF auth.uid() IS NULL OR _tenant IS NULL THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.print_hosts WHERE tenant_id = _tenant AND device_id = _device_id AND last_seen_at > clock_timestamp() - interval '45 seconds') THEN RETURN; END IF;
  RETURN QUERY SELECT * FROM public.claim_print_job(_job_id, _claimed_by);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_print_job_for_host(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_print_job_for_host(uuid,text,text) TO authenticated, service_role;