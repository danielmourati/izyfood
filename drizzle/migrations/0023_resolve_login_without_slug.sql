CREATE OR REPLACE FUNCTION public.resolve_login_any(_email text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN count(DISTINCT tm.login_email) = 1 THEN max(tm.login_email) ELSE lower(trim(_email)) END
  FROM public.tenant_members tm
  WHERE lower(tm.email) = lower(trim(_email)) AND tm.login_email IS NOT NULL;
$$;
GRANT EXECUTE ON FUNCTION public.resolve_login_any(text) TO anon, authenticated;