
-- Table for cash register movements (entries and withdrawals)
CREATE TYPE public.cash_movement_type AS ENUM ('entrada', 'saida');

CREATE TABLE public.cash_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cash_register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  type cash_movement_type NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  tenant_id UUID NOT NULL DEFAULT get_user_tenant_id() REFERENCES public.tenants(id)
);

ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin full access cash_movements" ON public.cash_movements FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Tenant members read cash_movements" ON public.cash_movements FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Tenant members insert cash_movements" ON public.cash_movements FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Tenant admins delete cash_movements" ON public.cash_movements FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_tenant_admin(auth.uid()));

-- Table for granular attendant permissions
CREATE TABLE public.attendant_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL DEFAULT get_user_tenant_id() REFERENCES public.tenants(id),
  manage_categories BOOLEAN NOT NULL DEFAULT false,
  manage_products BOOLEAN NOT NULL DEFAULT false,
  edit_prices BOOLEAN NOT NULL DEFAULT false,
  manage_stock BOOLEAN NOT NULL DEFAULT false,
  remove_order_items BOOLEAN NOT NULL DEFAULT false,
  cancel_orders BOOLEAN NOT NULL DEFAULT false,
  apply_discounts BOOLEAN NOT NULL DEFAULT false,
  manage_customers BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(user_id, tenant_id)
);

ALTER TABLE public.attendant_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin full access attendant_permissions" ON public.attendant_permissions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Tenant admins manage attendant_permissions" ON public.attendant_permissions FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_tenant_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_tenant_admin(auth.uid()));

CREATE POLICY "Users read own permissions" ON public.attendant_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
