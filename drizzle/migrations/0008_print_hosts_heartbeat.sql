CREATE TABLE public.print_hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  label text,
  user_name text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, device_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_hosts TO authenticated;
GRANT ALL ON public.print_hosts TO service_role;
ALTER TABLE public.print_hosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant select print_hosts" ON public.print_hosts FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant insert print_hosts" ON public.print_hosts FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant update print_hosts" ON public.print_hosts FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant delete print_hosts" ON public.print_hosts FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id());