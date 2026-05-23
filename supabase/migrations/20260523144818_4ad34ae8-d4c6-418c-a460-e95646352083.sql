
-- 1) PRIVILEGE ESCALATION FIX: only superadmins can manage user_roles
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;

CREATE POLICY "Superadmins manage user_roles"
ON public.user_roles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Admins read tenant member roles"
ON public.user_roles FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'superadmin'::app_role)
  OR (
    is_tenant_admin(auth.uid())
    AND user_id IN (
      SELECT tm.user_id FROM public.tenant_members tm
      WHERE tm.tenant_id = get_user_tenant_id()
    )
  )
);

-- 2) Tenant admins can DELETE members of their own tenant
CREATE POLICY "Tenant admins delete tenant_members"
ON public.tenant_members FOR DELETE TO authenticated
USING (tenant_id = get_user_tenant_id() AND is_tenant_admin(auth.uid()));

-- 3) Explicit INSERT policy on profiles (own row only)
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- 4) Explicit INSERT policy on audit_logs (own user + tenant)
CREATE POLICY "Users can insert audit logs for own tenant"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND tenant_id = get_user_tenant_id());

-- 5) Restrict public tenants exposure: drop broad anon SELECT, expose only branding via RPC
DROP POLICY IF EXISTS "Public can read tenant branding" ON public.tenants;

CREATE OR REPLACE FUNCTION public.get_tenant_branding(_slug text)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  logo text,
  login_icon text,
  login_carousel_images jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.id, t.name, t.slug, t.logo, t.login_icon, t.login_carousel_images
  FROM public.tenants t
  WHERE t.slug = _slug AND t.active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_tenant_branding(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_branding(text) TO anon, authenticated;

-- 6) Lock down SECURITY DEFINER helper functions: only used internally by RLS
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_tenant_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_tenant_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb) TO authenticated;

-- 7) Prevent listing on public storage buckets (files remain accessible via direct public URL)
DROP POLICY IF EXISTS "Public read tenant-assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read product-images" ON storage.objects;
