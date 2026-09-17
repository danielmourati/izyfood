UPDATE public.orders o
SET status = 'finalizado',
    completed_at = COALESCE(o.completed_at, s.date),
    held_at = NULL,
    payment_method = COALESCE(o.payment_method, s.payment_method),
    payment_splits = COALESCE(o.payment_splits, s.payment_splits)
FROM public.sales s
WHERE s.order_id = o.id
  AND o.status IN ('aberto', 'segurado', 'pronto');

UPDATE public.store_tables t
SET status = 'available', order_id = NULL
WHERE t.order_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = t.order_id
      AND o.status IN ('finalizado', 'cancelado')
  );