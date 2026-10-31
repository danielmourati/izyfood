CREATE OR REPLACE FUNCTION public.guard_order_finalize()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'finalizado' AND OLD.status NOT IN ('finalizado','cancelado')
     AND NEW.order_type = 'mesa' AND NEW.completed_at IS NULL
     AND jsonb_array_length(COALESCE(NEW.items,'[]'::jsonb)) > 0
     AND NOT EXISTS (SELECT 1 FROM public.sales s WHERE s.order_id = NEW.id) THEN
    INSERT INTO public.audit_logs(tenant_id, user_id, user_name, action, entity_type, entity_id, details)
    VALUES (NEW.tenant_id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      COALESCE((SELECT name FROM public.profiles WHERE id = auth.uid()), 'sistema'),
      'order_finalize_blocked', 'order', NEW.id::text,
      jsonb_build_object('mesa', NEW.table_number, 'total', NEW.total, 'motivo', 'finalizado sem pagamento'));
    NEW.status := OLD.status;
  END IF;
  IF NEW.table_number IS DISTINCT FROM OLD.table_number AND OLD.status NOT IN ('finalizado','cancelado') THEN
    INSERT INTO public.audit_logs(tenant_id, user_id, user_name, action, entity_type, entity_id, details)
    VALUES (NEW.tenant_id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      COALESCE((SELECT name FROM public.profiles WHERE id = auth.uid()), 'sistema'),
      'order_table_moved', 'order', NEW.id::text,
      jsonb_build_object('de', OLD.table_number, 'para', NEW.table_number, 'total', NEW.total));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_order_finalize ON public.orders;
CREATE TRIGGER trg_guard_order_finalize BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_order_finalize();

CREATE OR REPLACE FUNCTION public.move_order_table(_order_id uuid, _to integer)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _tenant uuid := get_user_tenant_id(); _from integer; _st order_status;
BEGIN
  SELECT table_number, status INTO _from, _st FROM public.orders WHERE id = _order_id AND tenant_id = _tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF _st IN ('finalizado','cancelado') THEN RAISE EXCEPTION 'order is closed'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE tenant_id = _tenant AND order_type = 'mesa'
             AND table_number = _to AND status IN ('aberto','segurado','pronto') AND id <> _order_id) THEN
    RAISE EXCEPTION 'table % already has an open order', _to;
  END IF;
  UPDATE public.orders SET table_number = _to, order_type = 'mesa' WHERE id = _order_id;
  IF _from IS NOT NULL AND _from <> _to THEN
    PERFORM set_config('app.releasing_order', _order_id::text, true);
    UPDATE public.store_tables SET status = 'available', order_id = NULL
    WHERE tenant_id = _tenant AND number = _from AND (order_id = _order_id OR order_id IS NULL);
    PERFORM set_config('app.releasing_order', '', true);
  END IF;
  INSERT INTO public.store_tables(number, status, order_id, tenant_id)
  VALUES (_to, 'occupied', _order_id, _tenant)
  ON CONFLICT (number, tenant_id) DO UPDATE SET status = 'occupied', order_id = _order_id;
  RETURN true;
END; $function$;