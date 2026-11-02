CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT tm.tenant_id FROM public.tenant_members tm
  JOIN public.tenants t ON t.id = tm.tenant_id AND t.active = true
  WHERE tm.user_id = auth.uid()
  ORDER BY tm.created_at ASC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.tenant_status(_slug text)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT CASE WHEN active THEN 'active' ELSE 'inactive' END FROM public.tenants WHERE slug = _slug LIMIT 1), 'missing');
$$;
GRANT EXECUTE ON FUNCTION public.tenant_status(text) TO anon, authenticated;