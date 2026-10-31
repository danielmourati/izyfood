CREATE OR REPLACE FUNCTION public.move_order_table(_order_id uuid, _to integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _tenant uuid := get_user_tenant_id(); _from integer; _st order_status; _dest record;
BEGIN
  SELECT table_number, status INTO _from, _st FROM public.orders WHERE id = _order_id AND tenant_id = _tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF _st IN ('finalizado','cancelado') THEN RAISE EXCEPTION 'order is closed'; END IF;
  IF _from = _to THEN RETURN true; END IF;
  PERFORM 1 FROM public.store_tables WHERE tenant_id = _tenant AND number IN (_from, _to) ORDER BY number FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.orders WHERE tenant_id = _tenant AND order_type = 'mesa'
             AND table_number = _to AND status IN ('aberto','segurado','pronto') AND id <> _order_id) THEN
    RAISE EXCEPTION 'Mesa % já está ocupada', _to;
  END IF;
  SELECT st.status, st.order_id, o.status AS ostatus INTO _dest
  FROM public.store_tables st LEFT JOIN public.orders o ON o.id = st.order_id
  WHERE st.tenant_id = _tenant AND st.number = _to;
  IF FOUND AND _dest.status = 'occupied' AND _dest.order_id IS NOT NULL AND _dest.order_id <> _order_id
     AND _dest.ostatus IS NOT NULL AND _dest.ostatus NOT IN ('finalizado','cancelado') THEN
    RAISE EXCEPTION 'Mesa % já está ocupada', _to;
  END IF;
  UPDATE public.orders SET table_number = _to, order_type = 'mesa' WHERE id = _order_id;
  IF _from IS NOT NULL THEN
    PERFORM set_config('app.releasing_order', _order_id::text, true);
    UPDATE public.store_tables SET status = 'available', order_id = NULL
    WHERE tenant_id = _tenant AND number = _from AND (order_id = _order_id OR order_id IS NULL);
    PERFORM set_config('app.releasing_order', '', true);
  END IF;
  INSERT INTO public.store_tables(number, status, order_id, tenant_id)
  VALUES (_to, 'occupied', _order_id, _tenant)
  ON CONFLICT (number, tenant_id) DO UPDATE SET status = 'occupied', order_id = _order_id;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.transfer_order_items(_from_order uuid, _to_table integer, _items jsonb DEFAULT NULL, _create_if_missing boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _tenant uuid := get_user_tenant_id();
  _src record; _dest_id uuid; _moved jsonb := '[]'; _kept jsonb := '[]';
  _it jsonb; _q numeric; _sel numeric; _full boolean; _new uuid;
BEGIN
  IF auth.uid() IS NULL OR _tenant IS NULL THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  SELECT * INTO _src FROM public.orders WHERE id = _from_order AND tenant_id = _tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF _src.status IN ('finalizado','cancelado') THEN RAISE EXCEPTION 'Pedido já fechado'; END IF;
  IF _src.table_number = _to_table THEN RAISE EXCEPTION 'Escolha outra mesa de destino'; END IF;

  FOR _it IN SELECT * FROM jsonb_array_elements(COALESCE(_src.items,'[]')) LOOP
    _q := COALESCE(NULLIF(_it->>'quantity','')::numeric, 1);
    IF _items IS NULL THEN _sel := _q;
    ELSE
      SELECT COALESCE(NULLIF(x->>'qty','')::numeric, 0) INTO _sel FROM jsonb_array_elements(_items) x WHERE x->>'id' = _it->>'id' LIMIT 1;
      _sel := LEAST(GREATEST(COALESCE(_sel,0),0), _q);
    END IF;
    IF _sel <= 0 THEN _kept := _kept || jsonb_build_array(_it);
    ELSIF _sel >= _q THEN _moved := _moved || jsonb_build_array(_it);
    ELSE
      _kept := _kept || jsonb_build_array(_it || jsonb_build_object('quantity', _q - _sel,
        'subtotal', round(COALESCE(NULLIF(_it->>'subtotal','')::numeric,0) * (_q - _sel) / _q, 2)));
      _moved := _moved || jsonb_build_array(_it || jsonb_build_object('id', gen_random_uuid()::text, 'quantity', _sel,
        'subtotal', round(COALESCE(NULLIF(_it->>'subtotal','')::numeric,0) * _sel / _q, 2)));
    END IF;
  END LOOP;
  IF jsonb_array_length(_moved) = 0 THEN RAISE EXCEPTION 'Nenhum item selecionado'; END IF;
  _full := jsonb_array_length(_kept) = 0;

  PERFORM 1 FROM public.store_tables WHERE tenant_id = _tenant AND number IN (_src.table_number, _to_table) ORDER BY number FOR UPDATE;
  SELECT id INTO _dest_id FROM public.orders WHERE tenant_id = _tenant AND order_type = 'mesa'
    AND table_number = _to_table AND status IN ('aberto','segurado','pronto') FOR UPDATE;

  IF _dest_id IS NULL THEN
    IF NOT _create_if_missing THEN RAISE EXCEPTION 'destination_missing'; END IF;
    IF _full THEN
      PERFORM public.move_order_table(_from_order, _to_table);
      PERFORM public.log_audit_event('items_transferred', 'order', _from_order::text,
        jsonb_build_object('de', _src.table_number, 'para', _to_table, 'tipo', 'total', 'itens', public.audit_items_summary(_moved)));
      RETURN jsonb_build_object('dest_order', _from_order, 'source_closed', false);
    END IF;
    INSERT INTO public.orders(items, total, order_type, status, table_number, tenant_id, opened_by, opened_by_name)
    VALUES ('[]', 0, 'mesa', 'aberto', _to_table, _tenant, _src.opened_by, _src.opened_by_name) RETURNING id INTO _dest_id;
    INSERT INTO public.store_tables(number, status, order_id, tenant_id) VALUES (_to_table, 'occupied', _dest_id, _tenant)
    ON CONFLICT (number, tenant_id) DO UPDATE SET status = 'occupied', order_id = _dest_id;
  END IF;

  PERFORM set_config('app.items_merge', 'on', true);
  PERFORM set_config('app.removed_ids', (SELECT string_agg(x->>'id', ',') FROM jsonb_array_elements(_src.items) x
    WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_kept) k WHERE k->>'id' = x->>'id')), true);
  UPDATE public.orders o SET items = COALESCE(o.items,'[]') || _moved,
    total = (SELECT COALESCE(sum(COALESCE(NULLIF(i->>'subtotal','')::numeric,0)),0) FROM jsonb_array_elements(COALESCE(o.items,'[]') || _moved) i)
  WHERE id = _dest_id;
  UPDATE public.orders SET items = _kept,
    total = (SELECT COALESCE(sum(COALESCE(NULLIF(i->>'subtotal','')::numeric,0)),0) FROM jsonb_array_elements(_kept) i)
  WHERE id = _from_order;
  PERFORM set_config('app.items_merge', 'off', true);
  PERFORM set_config('app.removed_ids', '', true);
  IF _full THEN
    UPDATE public.orders SET status = 'cancelado' WHERE id = _from_order;
  END IF;
  PERFORM public.log_audit_event('items_transferred', 'order', _from_order::text,
    jsonb_build_object('de', _src.table_number, 'para', _to_table, 'tipo', CASE WHEN _full THEN 'total' ELSE 'parcial' END,
      'pedido_destino', _dest_id, 'itens', public.audit_items_summary(_moved)));
  RETURN jsonb_build_object('dest_order', _dest_id, 'source_closed', _full);
END; $$;
GRANT EXECUTE ON FUNCTION public.transfer_order_items(uuid, integer, jsonb, boolean) TO authenticated;