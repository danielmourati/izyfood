CREATE OR REPLACE FUNCTION public.guard_table_release()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o record;
BEGIN
  IF OLD.order_id IS NOT NULL AND OLD.status = 'occupied'
     AND (NEW.status = 'available' OR NEW.order_id IS DISTINCT FROM OLD.order_id)
     AND COALESCE(current_setting('app.releasing_order', true), '') <> OLD.order_id::text THEN
    SELECT status, items, total, table_number, completed_at INTO _o FROM public.orders WHERE id = OLD.order_id;
    IF FOUND AND _o.status NOT IN ('finalizado','cancelado') AND _o.completed_at IS NULL
       AND _o.table_number = OLD.number
       AND (jsonb_array_length(COALESCE(_o.items,'[]'::jsonb)) > 0 OR COALESCE(_o.total,0) > 0) THEN
      INSERT INTO public.audit_logs(tenant_id, user_id, user_name, action, entity_type, entity_id, details)
      VALUES (OLD.tenant_id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE((SELECT name FROM public.profiles WHERE id = auth.uid()), 'sistema'),
        'table_free_blocked', 'table', OLD.order_id::text,
        jsonb_build_object('mesa', OLD.number, 'total', _o.total, 'pedido_solicitante', NEW.order_id));
      NEW.status := 'occupied';
      NEW.order_id := OLD.order_id;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.release_table_of_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM set_config('app.releasing_order', OLD.id::text, true);
    UPDATE public.store_tables SET status = 'available', order_id = NULL WHERE order_id = OLD.id;
    PERFORM set_config('app.releasing_order', '', true);
    RETURN OLD;
  END IF;
  IF NEW.status IN ('finalizado','cancelado') AND OLD.status NOT IN ('finalizado','cancelado') THEN
    UPDATE public.store_tables SET status = 'available', order_id = NULL WHERE order_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_release_table_of_order ON public.orders;
CREATE TRIGGER trg_release_table_of_order AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.release_table_of_order();
DROP TRIGGER IF EXISTS trg_release_table_before_order_delete ON public.orders;
CREATE TRIGGER trg_release_table_before_order_delete BEFORE DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.release_table_of_order();