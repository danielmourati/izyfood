CREATE OR REPLACE FUNCTION public.save_order_items(_order_id uuid, _items jsonb, _removed_ids text[] DEFAULT '{}')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- itens deste aparelho (impresso nunca volta a novo) + itens do banco que este aparelho não conhece e não removeu
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

  UPDATE public.orders SET items = _merged, total = _total WHERE id = _order_id;
  RETURN _merged;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_order_items(uuid, jsonb, text[]) TO authenticated;