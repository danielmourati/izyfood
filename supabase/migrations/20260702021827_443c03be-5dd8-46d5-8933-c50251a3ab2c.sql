CREATE TABLE public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  plan plan_type NOT NULL,
  amount numeric(10,2) NOT NULL,
  mp_payment_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  qr_code text,
  qr_code_base64 text,
  ticket_url text,
  paid_at timestamptz,
  expires_at timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_intents TO authenticated;
GRANT ALL ON public.payment_intents TO service_role;

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admin reads own payment intents"
  ON public.payment_intents FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_tenant_admin(auth.uid()));

CREATE POLICY "Superadmin reads all payment intents"
  ON public.payment_intents FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role));

CREATE TRIGGER payment_intents_updated_at
  BEFORE UPDATE ON public.payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_payment_intents_tenant ON public.payment_intents(tenant_id, created_at DESC);
CREATE INDEX idx_payment_intents_status ON public.payment_intents(status);