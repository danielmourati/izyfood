-- 1) Cancelar cupons da fila
CREATE OR REPLACE FUNCTION public.cancel_print_jobs(_ids uuid[] DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer; _tenant uuid := get_user_tenant_id(); _summary jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object('tipo', kind, 'status', status, 'mesa', payload->>'tableNumber', 'pedido', payload->>'id')), '[]'::jsonb)
    INTO _summary
  FROM public.print_jobs
  WHERE tenant_id = _tenant AND (_ids IS NULL OR id = ANY(_ids))
    AND (status IN ('pending','error') OR (status = 'printing' AND claimed_at < now() - interval '60 seconds'));

  DELETE FROM public.print_jobs
  WHERE tenant_id = _tenant AND (_ids IS NULL OR id = ANY(_ids))
    AND (status IN ('pending','error') OR (status = 'printing' AND claimed_at < now() - interval '60 seconds'));
  GET DIAGNOSTICS _n = ROW_COUNT;

  IF _n > 0 THEN
    INSERT INTO public.audit_logs(tenant_id, user_id, user_name, action, entity_type, entity_id, details)
    VALUES (_tenant, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      COALESCE((SELECT name FROM public.profiles WHERE id = auth.uid()), 'sistema'),
      'print_canceled', 'print_job', NULL, jsonb_build_object('quantidade', _n, 'cupons', _summary));
  END IF;
  RETURN _n;
END; $$;
GRANT EXECUTE ON FUNCTION public.cancel_print_jobs(uuid[]) TO authenticated;

-- 2) Liberar mesa somente pelo pedido dono
CREATE OR REPLACE FUNCTION public.release_table(_number integer, _order_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  UPDATE public.store_tables SET status = 'available', order_id = NULL
  WHERE tenant_id = get_user_tenant_id() AND number = _number
    AND (order_id = _order_id OR order_id IS NULL);
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n > 0;
END; $$;
GRANT EXECUTE ON FUNCTION public.release_table(integer, uuid) TO authenticated;

-- 3) Mudar pedido de mesa em uma só transação
CREATE OR REPLACE FUNCTION public.move_order_table(_order_id uuid, _to integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tenant uuid := get_user_tenant_id(); _from integer;
BEGIN
  SELECT table_number INTO _from FROM public.orders WHERE id = _order_id AND tenant_id = _tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE tenant_id = _tenant AND order_type = 'mesa'
             AND table_number = _to AND status IN ('aberto','segurado') AND id <> _order_id) THEN
    RAISE EXCEPTION 'table % already has an open order', _to;
  END IF;
  UPDATE public.orders SET table_number = _to, order_type = 'mesa' WHERE id = _order_id;
  IF _from IS NOT NULL AND _from <> _to THEN
    UPDATE public.store_tables SET status = 'available', order_id = NULL
    WHERE tenant_id = _tenant AND number = _from AND (order_id = _order_id OR order_id IS NULL);
  END IF;
  INSERT INTO public.store_tables(number, status, order_id, tenant_id)
  VALUES (_to, 'occupied', _order_id, _tenant)
  ON CONFLICT (number, tenant_id) DO UPDATE SET status = 'occupied', order_id = _order_id;
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.move_order_table(uuid, integer) TO authenticated;

-- 4) Banco nunca libera mesa com pedido aberto e com itens nela
CREATE OR REPLACE FUNCTION public.guard_table_release()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o record;
BEGIN
  IF OLD.order_id IS NOT NULL AND OLD.status = 'occupied'
     AND (NEW.status = 'available' OR NEW.order_id IS DISTINCT FROM OLD.order_id) THEN
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
DROP TRIGGER IF EXISTS trg_guard_table_release ON public.store_tables;
CREATE TRIGGER trg_guard_table_release BEFORE UPDATE ON public.store_tables
FOR EACH ROW EXECUTE FUNCTION public.guard_table_release();

-- 5) Pedido pago/cancelado/excluído libera a própria mesa
CREATE OR REPLACE FUNCTION public.release_table_of_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.store_tables SET status = 'available', order_id = NULL WHERE order_id = OLD.id;
    RETURN OLD;
  END IF;
  IF NEW.status IN ('finalizado','cancelado') AND OLD.status NOT IN ('finalizado','cancelado') THEN
    UPDATE public.store_tables SET status = 'available', order_id = NULL WHERE order_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_release_table_of_order ON public.orders;
CREATE TRIGGER trg_release_table_of_order AFTER UPDATE OF status OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.release_table_of_order();

-- 6) Itens só saem pela lixeira (save_order_items com ids explícitos)
CREATE OR REPLACE FUNCTION public.preserve_order_items()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _printed text[]; _missing jsonb;
BEGIN
  IF NEW.items IS NOT DISTINCT FROM OLD.items THEN RETURN NEW; END IF;
  IF COALESCE(current_setting('app.items_merge', true), '') = 'on' THEN RETURN NEW; END IF;

  SELECT COALESCE(array_agg(s->>'id'), '{}') INTO _printed
  FROM jsonb_array_elements(COALESCE(OLD.items,'[]'::jsonb)) s
  WHERE COALESCE((s->>'printed')::boolean,false) AND s->>'id' IS NOT NULL;

  SELECT COALESCE(jsonb_agg(o), '[]'::jsonb) INTO _missing
  FROM jsonb_array_elements(COALESCE(OLD.items,'[]'::jsonb)) o
  WHERE o->>'id' IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(NEW.items,'[]'::jsonb)) n WHERE n->>'id' = o->>'id');

  SELECT COALESCE(jsonb_agg(CASE WHEN n->>'id' = ANY(_printed) THEN jsonb_set(n,'{printed}','true'::jsonb) ELSE n END ORDER BY ord), '[]'::jsonb)
    INTO NEW.items
  FROM jsonb_array_elements(COALESCE(NEW.items,'[]'::jsonb)) WITH ORDINALITY AS t(n, ord);

  IF jsonb_array_length(_missing) > 0 THEN
    NEW.items := NEW.items || _missing;
    NEW.total := (SELECT COALESCE(sum(COALESCE(NULLIF(i->>'subtotal','')::numeric,0)),0) FROM jsonb_array_elements(NEW.items) i);
    INSERT INTO public.audit_logs(tenant_id, user_id, user_name, action, entity_type, entity_id, details)
    VALUES (NEW.tenant_id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      COALESCE((SELECT name FROM public.profiles WHERE id = auth.uid()), 'sistema'),
      'items_restored', 'order', NEW.id::text,
      jsonb_build_object('mesa', NEW.table_number, 'itens', public.audit_items_summary(_missing)));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_preserve_order_items ON public.orders;
CREATE TRIGGER trg_preserve_order_items BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.preserve_order_items();

CREATE OR REPLACE FUNCTION public.save_order_items(_order_id uuid, _items jsonb, _removed_ids text[] DEFAULT '{}'::text[])
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _server jsonb;
  _printed text[];
  _merged jsonb;
  _total numeric;
BEGIN
  SELECT items INTO _server FROM public.orders
  WHERE id = _order_id AND tenant_id = get_user_tenant_id()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  SELECT COALESCE(array_agg(s->>'id'), '{}') INTO _printed
  FROM jsonb_array_elements(COALESCE(_server, '[]'::jsonb)) s
  WHERE COALESCE((s->>'printed')::boolean, false) AND s->>'id' IS NOT NULL;

  SELECT COALESCE(jsonb_agg(x ORDER BY ord), '[]'::jsonb) INTO _merged FROM (
    SELECT CASE WHEN l->>'id' = ANY(_printed) THEN jsonb_set(l, '{printed}', 'true'::jsonb) ELSE l END AS x, n AS ord
    FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb)) WITH ORDINALITY AS t(l, n)
    UNION ALL
    SELECT s, 100000 + n
    FROM jsonb_array_elements(COALESCE(_server, '[]'::jsonb)) WITH ORDINALITY AS t2(s, n)
    WHERE s->>'id' IS NOT NULL
      AND NOT (s->>'id' = ANY(COALESCE(_removed_ids, '{}')))
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb)) l2 WHERE l2->>'id' = s->>'id')
  ) q;

  SELECT COALESCE(sum(COALESCE(NULLIF(i->>'subtotal','')::numeric, 0)), 0) INTO _total FROM jsonb_array_elements(_merged) i;

  PERFORM set_config('app.items_merge', 'on', true);
  PERFORM set_config('app.removed_ids', array_to_string(COALESCE(_removed_ids, '{}'), ','), true);
  UPDATE public.orders SET items = _merged, total = _total WHERE id = _order_id;
  PERFORM set_config('app.items_merge', 'off', true);
  PERFORM set_config('app.removed_ids', '', true);
  RETURN _merged;
END;
$function$;

-- 7) Auditoria indica a origem da remoção
CREATE OR REPLACE FUNCTION public.audit_order_changes()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _uname text;
  _removed jsonb;
  _reduced jsonb;
  _explicit text[] := string_to_array(NULLIF(current_setting('app.removed_ids', true), ''), ',');
  _origem text;
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

  IF NEW.status IN ('finalizado', 'cancelado') AND OLD.status NOT IN ('finalizado', 'cancelado') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(jsonb_agg(o), '[]'::jsonb) INTO _removed
  FROM jsonb_array_elements(COALESCE(OLD.items, '[]'::jsonb)) o
  WHERE o->>'id' IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb)) n WHERE n->>'id' = o->>'id');

  SELECT COALESCE(jsonb_agg(jsonb_set(o, '{quantity}', to_jsonb(
      COALESCE(NULLIF(o->>'quantity','')::numeric, 0) - COALESCE(NULLIF(n->>'quantity','')::numeric, 0)))), '[]'::jsonb)
    INTO _reduced
  FROM jsonb_array_elements(COALESCE(OLD.items, '[]'::jsonb)) o
  JOIN jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb)) n ON n->>'id' = o->>'id'
  WHERE o->>'id' IS NOT NULL
    AND COALESCE(NULLIF(n->>'quantity','')::numeric, 0) < COALESCE(NULLIF(o->>'quantity','')::numeric, 0);

  IF jsonb_array_length(_removed) > 0 OR jsonb_array_length(_reduced) > 0 THEN
    IF jsonb_array_length(_removed) > 0 AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(_removed) r WHERE NOT (r->>'id' = ANY(COALESCE(_explicit, '{}')))) THEN
      _origem := 'lixeira (usuário)';
    ELSIF jsonb_array_length(_removed) = 0 THEN
      _origem := 'quantidade reduzida (usuário)';
    ELSE
      _origem := 'sistema';
    END IF;
    INSERT INTO public.audit_logs(tenant_id, user_id, user_name, action, entity_type, entity_id, details)
    VALUES (NEW.tenant_id, COALESCE(_uid, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(_uname, 'sistema'),
      'items_removed', 'order', NEW.id::text,
      jsonb_build_object('mesa', NEW.table_number, 'tipo', NEW.order_type,
        'total_antes', OLD.total, 'total_depois', NEW.total, 'origem', _origem,
        'itens', public.audit_items_summary(_removed || _reduced)));
  END IF;
  RETURN NEW;
END;
$function$;