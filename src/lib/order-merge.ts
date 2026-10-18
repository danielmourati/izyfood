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

/**
 * Quando dois aparelhos abrem a mesma mesa, os itens do pedido recusado entram no
 * pedido que já existe, sem duplicar itens que ele já tem.
 */
export function absorbDuplicateOrderItems<T extends ItemLike>(existing: T[] | null | undefined, incoming: T[] | null | undefined): T[] {
  return mergeOrderItems((existing || []) as T[], [], incoming || []);
}

type TableOrderLike = { id: string; orderType?: string; tableNumber?: number | string | null; status?: string; completedAt?: string | null; createdAt?: string; items?: unknown[]; isLocked?: boolean };

const isOpenMesaOrderWithContent = (o: TableOrderLike) =>
  o.orderType === 'mesa' && !!o.tableNumber && !isTerminalStatus(o.status) && !o.completedAt
  && (((o.items?.length || 0) > 0) || !!o.isLocked || o.status === 'segurado');

/** Pedido que o cartão da mesa deve mostrar: o que a mesa aponta; senão o mais recente aberto. */
export function pickTableOrder<T extends TableOrderLike>(orders: T[], tableNumber: number, linkedOrderId?: string | null): T | undefined {
  const candidates = orders.filter(o => Number(o.tableNumber) === tableNumber && isOpenMesaOrderWithContent(o));
  if (linkedOrderId) {
    const linked = candidates.find(o => o.id === linkedOrderId);
    if (linked) return linked;
  }
  return [...candidates].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
}

/** Pedido com itens/valor no banco só sai por exclusão explícita (excluir confirmado, mesclar, descartar balcão). */
export function canDeleteOrder(server: { items?: unknown[] | null; total?: number | string | null } | null | undefined, explicit: boolean): boolean {
  if (explicit || !server) return true;
  return (server.items?.length || 0) === 0 && (Number(server.total) || 0) === 0;
}

const explicitDeletes = new Set<string>();
/** Marca uma exclusão de pedido como pedida pelo usuário. */
export function allowOrderDelete(id: string) { explicitDeletes.add(id); }
/** Consome a autorização (uma vez). */
export function consumeOrderDelete(id: string): boolean {
  const had = explicitDeletes.has(id);
  explicitDeletes.delete(id);
  return had;
}

const explicitItemRemovals = new Map<string, Set<string>>();
/** Marca a remoção de um item como pedida pelo usuário (lixeira). */
export function allowItemRemoval(orderId: string, itemId: string) {
  if (!explicitItemRemovals.has(orderId)) explicitItemRemovals.set(orderId, new Set());
  explicitItemRemovals.get(orderId)!.add(itemId);
}
/** Consome as remoções autorizadas do pedido. */
export function consumeItemRemovals(orderId: string): string[] {
  const s = explicitItemRemovals.get(orderId);
  explicitItemRemovals.delete(orderId);
  return s ? [...s] : [];
}
