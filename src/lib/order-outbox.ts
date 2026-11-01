import type { Order } from '@/types';
import { isTerminalStatus } from './order-merge';

export interface PendingOrderWrite {
  order: Order;
  base?: Order;
  removedIds: string[];
  revision: string;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** Durable per-tenant journal. Storage failures are surfaced, never silently discarded. */
export class OrderOutbox {
  private key: string;
  constructor(private storage: StorageLike, tenantId: string) {
    this.key = `degust_order_outbox:${tenantId}`;
  }

  list(): PendingOrderWrite[] {
    const raw = this.storage.getItem(this.key);
    if (!raw) return [];
    const entries: PendingOrderWrite[] = JSON.parse(raw);
    if (!Array.isArray(entries)) throw new Error('Não foi possível ler os pedidos pendentes deste aparelho.');
    return entries;
  }

  enqueue(order: Order, base?: Order, removedIds: string[] = []) {
    const entries = this.list();
    const previous = entries.find(e => e.order.id === order.id);
    const present = new Set(order.items.map(i => i.id));
    const entry: PendingOrderWrite = {
      order, base: previous ? previous.base : base,
      removedIds: [...new Set([...(previous?.removedIds ?? []), ...removedIds])].filter(id => !present.has(id)),
      revision: crypto.randomUUID(),
    };
    this.storage.setItem(this.key, JSON.stringify([...entries.filter(e => e.order.id !== order.id), entry]));
    return entry;
  }

  acknowledge(entry: PendingOrderWrite) {
    this.storage.setItem(this.key, JSON.stringify(this.list().filter(e =>
      e.order.id !== entry.order.id || e.revision !== entry.revision)));
  }

  discard(orderId: string) {
    this.storage.setItem(this.key, JSON.stringify(this.list().filter(e => e.order.id !== orderId)));
  }
}

/** Apply only unsaved changes, not unchanged stale items; explicit removals stay removed. */
export function overlayPendingOrder(server: Order | undefined, entry: PendingOrderWrite): Order {
  if (!server) return entry.order;
  if (isTerminalStatus(server.status)) return server;
  const baseItems = new Map((entry.base?.items ?? []).map(i => [i.id, i]));
  const changed = entry.order.items.filter(i => JSON.stringify(i) !== JSON.stringify(baseItems.get(i.id)));
  const removed = new Set(entry.removedIds);
  const merged = new Map(server.items.filter(i => !removed.has(i.id)).map(i => [i.id, i]));
  for (const item of changed) {
    merged.set(item.id, { ...item, printed: !!item.printed || !!merged.get(item.id)?.printed });
  }
  const items = [...merged.values()];
  return { ...server, items, total: items.reduce((sum, i) => sum + i.subtotal, 0) };
}

export function reconcilePendingOrders(server: Order[], entries: PendingOrderWrite[]): Order[] {
  const byId = new Map(server.map(o => [o.id, o]));
  for (const entry of entries) byId.set(entry.order.id, overlayPendingOrder(byId.get(entry.order.id), entry));
  return [...byId.values()];
}