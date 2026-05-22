ALTER TABLE public.printer_configs REPLICA IDENTITY FULL;
ALTER TABLE public.cash_movements REPLICA IDENTITY FULL;
ALTER TABLE public.product_note_options REPLICA IDENTITY FULL;
ALTER TABLE public.commission_records REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE
  public.printer_configs,
  public.cash_movements,
  public.commission_records,
  public.profiles,
  public.user_roles;