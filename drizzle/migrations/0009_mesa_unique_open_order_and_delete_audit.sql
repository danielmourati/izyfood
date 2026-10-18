CREATE UNIQUE INDEX IF NOT EXISTS orders_one_open_per_table
  ON public.orders (tenant_id, table_number)
  WHERE order_type = 'mesa' AND status IN ('aberto', 'segurado') AND table_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.audit_items_summary(_items jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nome', i->>'name',
    'qtd', i->>'quantity',
    'impresso', COALESCE((i->>'printed')::boolean, false),
    'lancado_por', i->>'addedByName'
  )), '[]'::jsonb)
  FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb)) i;
$$;

CREATE OR REPLACE FUNCTION public.audit_order_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _uname text;
  _removed jsonb;
BEGIN
  SELECT name INTO _uname FROM public.profiles WHERE id = _uid;

  IF TG_OP = 'DELETE' THEN
    IF jsonb_array_length(COALESCE(OLD.items, '[]'::jsonb)) = 0 AND COALESCE(OLD.total, 0) = 0 THEN
      RETURN OLD;
    END IF;
    INSERT INTO public.audit_logs(tenant_id, user_id, user_name, action, entity_type, entity_id, details)
    VALUES (OLD.tenant_id, COALESCE(_uid, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(_uname, 'sistema'),
      'order_deleted', 'order', OLD.id::text,
      jsonb_build_object('mesa', OLD.table_number, 'tipo', OLD.order_type, 'status', OLD.status,
        'total', OLD.total, 'aberto_por', OLD.opened_by_name, 'itens', public.audit_items_summary(OLD.items)));
    RETURN OLD;
  END IF;

  -- UPDATE: itens que existiam e sumiram (exceto quando o pedido está sendo encerrado)
  IF NEW.status IN ('finalizado', 'cancelado') AND OLD.status NOT IN ('finalizado', 'cancelado') THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(jsonb_agg(o), '[]'::jsonb) INTO _removed
  FROM jsonb_array_elements(COALESCE(OLD.items, '[]'::jsonb)) o
  WHERE o->>'id' IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb)) n WHERE n->>'id' = o->>'id'
    );
  IF jsonb_array_length(_removed) > 0 THEN
    INSERT INTO public.audit_logs(tenant_id, user_id, user_name, action, entity_type, entity_id, details)
    VALUES (NEW.tenant_id, COALESCE(_uid, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(_uname, 'sistema'),
      'items_removed', 'order', NEW.id::text,
      jsonb_build_object('mesa', NEW.table_number, 'tipo', NEW.order_type,
        'total_antes', OLD.total, 'total_depois', NEW.total, 'itens', public.audit_items_summary(_removed)));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_order_delete ON public.orders;
CREATE TRIGGER trg_audit_order_delete AFTER DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_order_changes();
DROP TRIGGER IF EXISTS trg_audit_order_update ON public.orders;
CREATE TRIGGER trg_audit_order_update AFTER UPDATE OF items, status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_order_changes();

CREATE OR REPLACE FUNCTION public.audit_table_freed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _uname text;
  _o record;
BEGIN
  IF OLD.status = 'occupied' AND NEW.status = 'available' AND OLD.order_id IS NOT NULL THEN
    SELECT status, total, items, opened_by_name INTO _o FROM public.orders WHERE id = OLD.order_id;
    IF FOUND AND _o.status IN ('finalizado', 'cancelado') THEN
      RETURN NEW;
    END IF;
    IF FOUND AND jsonb_array_length(COALESCE(_o.items, '[]'::jsonb)) = 0 AND COALESCE(_o.total, 0) = 0 THEN
      RETURN NEW;
    END IF;
    SELECT name INTO _uname FROM public.profiles WHERE id = _uid;
    INSERT INTO public.audit_logs(tenant_id, user_id, user_name, action, entity_type, entity_id, details)
    VALUES (NEW.tenant_id, COALESCE(_uid, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(_uname, 'sistema'),
      'table_freed', 'table', OLD.order_id::text,
      jsonb_build_object('mesa', OLD.number, 'pedido_existe', FOUND,
        'status_pedido', CASE WHEN FOUND THEN _o.status::text END,
        'total', CASE WHEN FOUND THEN _o.total END,
        'aberto_por', CASE WHEN FOUND THEN _o.opened_by_name END));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_table_freed ON public.store_tables;
CREATE TRIGGER trg_audit_table_freed AFTER UPDATE OF status ON public.store_tables
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_freed();