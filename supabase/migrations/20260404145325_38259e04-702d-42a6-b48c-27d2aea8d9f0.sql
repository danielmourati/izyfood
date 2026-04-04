
CREATE POLICY "Tenant admins can update tenant_members"
ON public.tenant_members
FOR UPDATE
TO authenticated
USING (tenant_id = get_user_tenant_id() AND is_tenant_admin(auth.uid()))
WITH CHECK (tenant_id = get_user_tenant_id() AND is_tenant_admin(auth.uid()));

CREATE POLICY "Tenant admins can insert tenant_members"
ON public.tenant_members
FOR INSERT
TO authenticated
WITH CHECK (tenant_id = get_user_tenant_id() AND is_tenant_admin(auth.uid()));
