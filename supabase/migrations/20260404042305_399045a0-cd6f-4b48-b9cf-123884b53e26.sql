CREATE OR REPLACE FUNCTION public.seed_default_tables()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.store_tables (number, status, tenant_id)
  VALUES
    (1, 'available', NEW.id),
    (2, 'available', NEW.id),
    (3, 'available', NEW.id),
    (4, 'available', NEW.id),
    (5, 'available', NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_tenant_created_seed_tables
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_tables();