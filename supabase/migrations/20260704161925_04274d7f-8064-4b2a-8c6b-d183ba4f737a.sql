-- Ensure RLS is enabled
ALTER TABLE public.qz_tray_certs ENABLE ROW LEVEL SECURITY;

-- Grants (were missing)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qz_tray_certs TO authenticated;
GRANT ALL ON public.qz_tray_certs TO service_role;

-- Drop any prior policies to keep this idempotent
DROP POLICY IF EXISTS "Tenant admins can view qz_tray_certs" ON public.qz_tray_certs;
DROP POLICY IF EXISTS "Tenant admins can insert qz_tray_certs" ON public.qz_tray_certs;
DROP POLICY IF EXISTS "Tenant admins can update qz_tray_certs" ON public.qz_tray_certs;
DROP POLICY IF EXISTS "Tenant admins can delete qz_tray_certs" ON public.qz_tray_certs;

CREATE POLICY "Tenant admins can view qz_tray_certs"
ON public.qz_tray_certs
FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()));

CREATE POLICY "Tenant admins can insert qz_tray_certs"
ON public.qz_tray_certs
FOR INSERT
TO authenticated
WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()));

CREATE POLICY "Tenant admins can update qz_tray_certs"
ON public.qz_tray_certs
FOR UPDATE
TO authenticated
USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()));

CREATE POLICY "Tenant admins can delete qz_tray_certs"
ON public.qz_tray_certs
FOR DELETE
TO authenticated
USING (tenant_id = public.get_user_tenant_id() AND public.is_tenant_admin(auth.uid()));