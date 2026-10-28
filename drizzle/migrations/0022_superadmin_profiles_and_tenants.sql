-- Allow superadmin to read and update all profiles
DROP POLICY IF EXISTS "Superadmins read all profiles" ON public.profiles;
CREATE POLICY "Superadmins read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

DROP POLICY IF EXISTS "Superadmins update all profiles" ON public.profiles;
CREATE POLICY "Superadmins update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

-- Helper RPC for SuperAdmin to fetch all users across all tenants reliably
CREATE OR REPLACE FUNCTION public.get_all_superadmin_users()
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  phone text,
  role text,
  tenant_id uuid,
  tenant_name text,
  tenant_slug text,
  created_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'superadmin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas superadmin';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    COALESCE(p.name, 'Usuário sem nome') as name,
    COALESCE(p.email, '') as email,
    COALESCE(p.phone, '') as phone,
    COALESCE(ur.role::text, tm.role::text, 'atendente') as role,
    tm.tenant_id,
    COALESCE(t.name, '—') as tenant_name,
    COALESCE(t.slug, '') as tenant_slug,
    p.created_at
  FROM profiles p
  LEFT JOIN tenant_members tm ON tm.user_id = p.id
  LEFT JOIN tenants t ON t.id = tm.tenant_id
  LEFT JOIN user_roles ur ON ur.user_id = p.id
  ORDER BY p.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_superadmin_users() TO authenticated;
