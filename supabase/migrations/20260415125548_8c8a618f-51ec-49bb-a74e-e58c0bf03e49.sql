
-- 1. Fix get_user_tenant_id: add deterministic ORDER BY
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $$
  SELECT tenant_id FROM public.tenant_members
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;
$$;

-- 2. Fix is_tenant_admin: scope to current tenant
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = _user_id
      AND tenant_id = get_user_tenant_id()
      AND role IN ('admin', 'superadmin')
  );
$$;

-- 3. Fix profiles SELECT policy: restrict to same-tenant members + self
DROP POLICY IF EXISTS "Anyone authenticated can read profiles" ON profiles;
CREATE POLICY "Tenant members read profiles" ON profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR id IN (
      SELECT user_id FROM tenant_members
      WHERE tenant_id = get_user_tenant_id()
    )
  );

-- 4. Create server-side audit log function and remove direct INSERT policy
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO audit_logs(user_id, user_name, tenant_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    (SELECT name FROM profiles WHERE id = auth.uid()),
    get_user_tenant_id(),
    p_action, p_entity_type, p_entity_id, p_details
  );
END;
$$;

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON audit_logs;

-- 5. Fix storage policies for tenant-assets bucket
DROP POLICY IF EXISTS "Authenticated users upload tenant-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users update tenant-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users delete tenant-assets" ON storage.objects;

CREATE POLICY "Tenant-scoped upload tenant-assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-assets'
    AND (storage.foldername(name))[1] = get_user_tenant_id()::text
  );

CREATE POLICY "Tenant-scoped update tenant-assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tenant-assets'
    AND (storage.foldername(name))[1] = get_user_tenant_id()::text
  );

CREATE POLICY "Tenant-scoped delete tenant-assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'tenant-assets'
    AND (storage.foldername(name))[1] = get_user_tenant_id()::text
  );

-- 6. Fix storage policies for product-images bucket
DROP POLICY IF EXISTS "Authenticated users upload product-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users update product-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users delete product-images" ON storage.objects;

CREATE POLICY "Tenant-scoped upload product-images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = get_user_tenant_id()::text
  );

CREATE POLICY "Tenant-scoped update product-images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = get_user_tenant_id()::text
  );

CREATE POLICY "Tenant-scoped delete product-images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = get_user_tenant_id()::text
  );
