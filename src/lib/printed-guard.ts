import { supabase } from '@/integrations/supabase/client';

type ItemLike = { id?: string; printed?: boolean };

/** Uma vez impresso, sempre impresso: nunca rebaixa `printed` de true para false. */
export function mergePrintedFlags<T extends ItemLike>(local: T[], remote: ItemLike[] | null | undefined): T[] {
  const printedIds = new Set((remote || []).filter(i => i?.printed && i.id).map(i => i.id as string));
  if (printedIds.size === 0) return local;
  return local.map(i => (i.id && printedIds.has(i.id) && !i.printed ? { ...i, printed: true } : i));
}

/** Remove itens que já saíram na cozinha (marcados no banco ou já enviados à fila como novos). */
export function excludeAlreadySent<T extends ItemLike>(items: T[], sentIds: Set<string>): T[] {
  return items.filter(i => !i.id || !sentIds.has(i.id));
}

export async function fetchAlreadySentItemIds(orderId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  try {
    const [{ data: order }, { data: jobs }] = await Promise.all([
      supabase.from('orders').select('items').eq('id', orderId).maybeSingle(),
      supabase.from('print_jobs' as any).select('payload').eq('kind', 'order').eq('payload->>id', orderId).limit(200),
    ]);
    for (const i of ((order as any)?.items || []) as ItemLike[]) if (i?.printed && i.id) ids.add(i.id);
    for (const j of (jobs || []) as any[]) {
      if (j?.payload?.__printIntent === 'reprint') continue;
      for (const i of (j?.payload?.items || []) as ItemLike[]) if (i?.id) ids.add(i.id);
    }
  } catch (err) {
    console.warn('[printed-guard] não foi possível conferir itens já impressos', err);
  }
  return ids;
}
