
-- 1) QZ Tray tenant certificates
CREATE TABLE IF NOT EXISTS public.qz_tray_certs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE,
  cert_pem text NOT NULL,
  private_key_pem text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.qz_tray_certs TO service_role;

ALTER TABLE public.qz_tray_certs ENABLE ROW LEVEL SECURITY;

-- No policies: table is only accessible via service_role in the qz-cert edge function.

CREATE TRIGGER update_qz_tray_certs_updated_at
BEFORE UPDATE ON public.qz_tray_certs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Sector column for printer_configs
ALTER TABLE public.printer_configs
  ADD COLUMN IF NOT EXISTS sector text NOT NULL DEFAULT 'recibo';

ALTER TABLE public.printer_configs
  DROP CONSTRAINT IF EXISTS printer_configs_sector_check;

ALTER TABLE public.printer_configs
  ADD CONSTRAINT printer_configs_sector_check
  CHECK (sector IN ('recibo', 'cozinha', 'bar', 'balcao'));
