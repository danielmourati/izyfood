
-- Create tenants table
CREATE TABLE public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Create tenant_members table
CREATE TABLE public.tenant_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'atendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

-- Helper function: get_user_tenant_id()
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tenant_members
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

-- RLS policies for tenants
CREATE POLICY "Superadmins can do everything on tenants"
  ON public.tenants FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Members can read own tenant"
  ON public.tenants FOR SELECT
  TO authenticated
  USING (id = public.get_user_tenant_id());

-- RLS policies for tenant_members
CREATE POLICY "Superadmins can do everything on tenant_members"
  ON public.tenant_members FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Members can read own tenant members"
  ON public.tenant_members FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

-- Insert default tenant and migrate existing users
INSERT INTO public.tenants (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Loja Padrão', 'loja-padrao');

INSERT INTO public.tenant_members (tenant_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001', ur.user_id, ur.role
FROM public.user_roles ur
ON CONFLICT (tenant_id, user_id) DO NOTHING;
