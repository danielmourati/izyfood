-- Remove orphan user_roles and profiles that have no tenant_members and are not superadmin
DELETE FROM public.user_roles ur
WHERE ur.role <> 'superadmin'
  AND NOT EXISTS (
    SELECT 1 FROM public.tenant_members tm
    JOIN public.tenants t ON t.id = tm.tenant_id
    WHERE tm.user_id = ur.user_id
  );

-- Update get_all_superadmin_users RPC to exclude users without a valid tenant (unless superadmin)
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
    COALESCE(tm.email, p.email, '') as email,
    COALESCE(p.phone, '') as phone,
    COALESCE(ur.role::text, tm.role::text, 'atendente') as role,
    t.id as tenant_id,
    COALESCE(t.name, '—') as tenant_name,
    COALESCE(t.slug, '') as tenant_slug,
    p.created_at
  FROM profiles p
  LEFT JOIN tenant_members tm ON tm.user_id = p.id
  LEFT JOIN tenants t ON t.id = tm.tenant_id
  LEFT JOIN user_roles ur ON ur.user_id = p.id
  WHERE COALESCE(ur.role::text, '') = 'superadmin'
     OR t.id IS NOT NULL
  ORDER BY
    CASE WHEN COALESCE(ur.role::text, '') = 'superadmin' THEN 0 ELSE 1 END,
    COALESCE(t.name, ''),
    CASE COALESCE(ur.role::text, tm.role::text, 'atendente')
      WHEN 'admin' THEN 1
      WHEN 'atendente' THEN 2
      WHEN 'motoboy' THEN 3
      ELSE 4
    END,
    p.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_superadmin_users() TO authenticated;

