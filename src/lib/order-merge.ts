type ItemLike = { id?: string; subtotal?: number };

export const TERMINAL_STATUSES = ['finalizado', 'cancelado', 'concluido'];
export const isTerminalStatus = (s?: string | null) => !!s && TERMINAL_STATUSES.includes(s);

/**
 * Junta os itens deste aparelho com os do banco: itens que outro aparelho gravou
 * (e que este aparelho nunca conheceu) são preservados; itens removidos aqui não voltam.
 */
export function mergeOrderItems<T extends ItemLike>(localNext: T[], localPrev: ItemLike[] | undefined, server: T[] | null | undefined): T[] {
  const nextIds = new Set(localNext.map(i => i.id).filter(Boolean) as string[]);
  const prevIds = new Set((localPrev || []).map(i => i.id).filter(Boolean) as string[]);
  const extra = (server || []).filter(i => i?.id && !nextIds.has(i.id) && !prevIds.has(i.id));
  return extra.length ? [...localNext, ...extra] : localNext;
}
