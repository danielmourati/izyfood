ALTER TABLE public.printer_configs
  ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT 'ESC/POS compatível',
  ADD COLUMN IF NOT EXISTS escpos_profile text NOT NULL DEFAULT 'generic',
  ADD COLUMN IF NOT EXISTS auto_connect_qz boolean NOT NULL DEFAULT false;