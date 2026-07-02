
CREATE TABLE public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'mercadopago',
  event_type text,
  event_id text,
  signature_valid boolean,
  processed boolean NOT NULL DEFAULT false,
  error text,
  headers jsonb,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins view webhook events"
ON public.webhook_events FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'));

CREATE INDEX idx_webhook_events_created_at ON public.webhook_events(created_at DESC);
