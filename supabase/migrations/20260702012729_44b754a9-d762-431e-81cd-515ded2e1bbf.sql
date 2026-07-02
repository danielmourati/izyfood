
-- Enums
DO $$ BEGIN
  CREATE TYPE public.plan_type AS ENUM ('trial', 'pro_monthly', 'pro_yearly');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.plan_status AS ENUM ('active', 'expired', 'canceled', 'pending_payment');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.tenant_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan public.plan_type NOT NULL DEFAULT 'trial',
  status public.plan_status NOT NULL DEFAULT 'active',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  last_payment_at timestamptz,
  mp_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_plans TO authenticated;
GRANT ALL ON public.tenant_plans TO service_role;

-- RLS
ALTER TABLE public.tenant_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant plan"
  ON public.tenant_plans FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id() OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Superadmins manage tenant plans"
  ON public.tenant_plans FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- updated_at trigger
CREATE TRIGGER trg_tenant_plans_updated_at
  BEFORE UPDATE ON public.tenant_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-seed trial when a tenant is created
CREATE OR REPLACE FUNCTION public.seed_tenant_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tenant_plans (tenant_id, plan, status, trial_ends_at)
  VALUES (NEW.id, 'trial', 'active', now() + interval '14 days')
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_tenant_trial ON public.tenants;
CREATE TRIGGER trg_seed_tenant_trial
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_tenant_trial();

-- Backfill for existing tenants
INSERT INTO public.tenant_plans (tenant_id, plan, status, trial_ends_at)
SELECT t.id, 'trial', 'active', now() + interval '14 days'
FROM public.tenants t
LEFT JOIN public.tenant_plans tp ON tp.tenant_id = t.id
WHERE tp.id IS NULL;

-- Helper
CREATE OR REPLACE FUNCTION public.is_tenant_pro(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_plans
    WHERE tenant_id = _tenant_id
      AND plan IN ('pro_monthly', 'pro_yearly')
      AND status = 'active'
      AND (current_period_end IS NULL OR current_period_end > now())
  );
$$;
