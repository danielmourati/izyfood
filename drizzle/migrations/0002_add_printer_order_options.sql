ALTER TABLE public.printer_configs
  ADD COLUMN IF NOT EXISTS double_font_orders boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_new_orders boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.printer_configs.double_font_orders IS 'Amplia título, número, itens e adicionais das comandas de produção.';
COMMENT ON COLUMN public.printer_configs.duplicate_new_orders IS 'Imprime duas vias somente para envios de pedidos novos.';