
CREATE TABLE public.printer_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT get_user_tenant_id() REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  connection_type text NOT NULL CHECK (connection_type IN ('bluetooth','network')),
  address text NOT NULL DEFAULT '',
  paper_width integer NOT NULL DEFAULT 80,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.printer_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read printer_configs" ON printer_configs
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Tenant members insert printer_configs" ON printer_configs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Tenant members update printer_configs" ON printer_configs
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Tenant admins delete printer_configs" ON printer_configs
  FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_tenant_admin(auth.uid()));

CREATE POLICY "Superadmin full access printer_configs" ON printer_configs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'superadmin'))
  WITH CHECK (has_role(auth.uid(), 'superadmin'));
