import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreProvider, useStore } from '@/contexts/StoreContext';

const mock = vi.hoisted(() => ({
  user: { id: 'user-a', tenantId: 'tenant-a', tenantSlug: 'test' },
  counts: {} as Record<string, number>,
  handlers: {} as Record<string, (payload?: any) => void>,
  queries: [] as { table: string; filters: Record<string, unknown> }[],
  read: null as null | ((table: string, count: number) => Promise<unknown[]>),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mock.user }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: (table: string) => {
    const builder: Record<string, unknown> = {};
    const filters: Record<string, unknown> = {};
    for (const method of ['select', 'order', 'eq', 'or', 'is', 'limit', 'maybeSingle', 'gte', 'lte', 'range', 'in']) builder[method] = (...args: unknown[]) => { filters[`${method}:${args[0]}`] = args.slice(1); return builder; };
    builder.then = (resolve: (value: unknown) => void, reject: (error: unknown) => void) => {
      const count = mock.counts[table] = (mock.counts[table] || 0) + 1;
      mock.queries.push({ table, filters });
      return (mock.read?.(table, count) ?? Promise.resolve([])).then(data => resolve({ data, error: null }), reject);
    };
    return builder;
  },
  channel: () => {
    const channel = {
      on: (_event: string, filter: { table?: string; event?: string }, handler: (payload?: any) => void) => {
        if (filter.table || filter.event) mock.handlers[filter.table || filter.event || ''] = handler;
        return channel;
      },
      subscribe: () => channel,
    };
    return channel;
  },
  removeChannel: vi.fn(),
} }));

let store: ReturnType<typeof useStore>;
function Probe() { store = useStore(); return null; }
function gate() {
  let resolve: (rows: unknown[]) => void = () => {};
  const promise = new Promise<unknown[]>(yes => { resolve = yes; });
  return { promise, resolve };
}
const row = (id: string) => ({ id, items: [], total: 0, order_type: 'mesa', status: 'aberto', table_number: 1, created_at: '2026-11-02' });

beforeEach(() => {
  localStorage.clear();
  mock.user = { id: 'user-a', tenantId: 'tenant-a', tenantSlug: 'test' };
  mock.counts = {}; mock.handlers = {}; mock.read = null; mock.queries = [];
});
afterEach(cleanup);

describe('StoreProvider shared reads', () => {
  it('shares full refresh overlap and combines order/table events into one fresh pair', async () => {
    const pending = gate();
    mock.read = async (table, count) => table === 'orders'
      ? count === 1 ? pending.promise : [row('fresh')]
      : [];
    render(<StoreProvider><Probe /></StoreProvider>);
    await waitFor(() => expect(mock.counts.orders).toBe(1));
    let first = Promise.resolve();
    let second = Promise.resolve();
    act(() => { first = store.fetchAll(); second = store.fetchAll(); });
    expect(mock.counts.orders).toBe(1);
    act(() => { mock.handlers.orders(); mock.handlers.store_tables({ eventType: 'UPDATE' }); });
    await act(async () => { pending.resolve([row('fresh')]); await Promise.all([first, second]); });
    expect(mock.counts.orders).toBe(2);
    expect(mock.counts.store_tables).toBe(2);
    expect(store.orders.map(o => o.id)).toEqual(['fresh']);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
    expect(mock.counts.orders).toBe(2);
  });

  it('does not let a previous tenant response overwrite the current tenant', async () => {
    const pending = gate();
    mock.read = async (table, count) => table === 'orders'
      ? count === 1 ? pending.promise : [row('tenant-b-order')]
      : [];
    const view = render(<StoreProvider><Probe /></StoreProvider>);
    await waitFor(() => expect(mock.counts.orders).toBe(1));
    act(() => { mock.handlers.orders(); });
    mock.user = { id: 'user-b', tenantId: 'tenant-b', tenantSlug: 'test' };
    view.rerender(<StoreProvider><Probe /></StoreProvider>);
    await waitFor(() => expect(store.orders.map(o => o.id)).toEqual(['tenant-b-order']));
    await act(async () => { pending.resolve([row('tenant-b-order')]); });
    expect(store.orders.map(o => o.id)).toEqual(['tenant-b-order']);
    expect(mock.counts.orders).toBe(2);
  });

  it('applies a complete product event without querying products, sales or orders again', async () => {
    render(<StoreProvider><Probe /></StoreProvider>);
    await waitFor(() => expect(store.loading).toBe(false));
    const before = { ...mock.counts };
    act(() => { mock.handlers.products({ eventType: 'UPDATE', new: { id: 'p1', tenant_id: 'tenant-a', name: 'Pastel', price: 15, stock: 0, type: 'unit', unit: 'un' } }); });
    expect(store.products.find(p => p.id === 'p1')?.price).toBe(15);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
    expect(mock.counts).toEqual(before);
  });

  it('a broadcast refreshes only its changed entity and ignores another tenant', async () => {
    render(<StoreProvider><Probe /></StoreProvider>);
    await waitFor(() => expect(store.loading).toBe(false));
    const before = { ...mock.counts };
    act(() => { mock.handlers.store_update({ payload: { senderId: 'other', tenantId: 'tenant-a', entities: ['customers'] } }); });
    await waitFor(() => expect(mock.counts.customers).toBe(before.customers + 1));
    expect(mock.counts.products).toBe(before.products);
    expect(mock.counts.sales).toBe(before.sales);
    expect(mock.counts.orders).toBe(before.orders);
    act(() => { mock.handlers.store_update({ payload: { senderId: 'other', tenantId: 'tenant-b', entities: ['customers'] } }); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
    expect(mock.counts.customers).toBe(before.customers + 1);
  });

  it('keeps a linked closed order checked separately from all active statuses', async () => {
    mock.read = async (table, count) => table === 'store_tables' ? [{ number: 1, status: 'occupied', order_id: 'paid' }]
      : table === 'orders' && count === 2 ? [{ ...row('paid'), status: 'finalizado' }] : [];
    render(<StoreProvider><Probe /></StoreProvider>);
    await waitFor(() => expect(store.loading).toBe(false));
    const orderQueries = mock.queries.filter(q => q.table === 'orders');
    expect(orderQueries[0].filters['in:status']).toEqual([['aberto', 'segurado', 'pronto']]);
    expect(orderQueries[1].filters['in:id']).toEqual([['paid']]);
    expect(store.orders.find(o => o.id === 'paid')?.status).toBe('finalizado');
    expect(store.tables.find(t => t.number === 1)?.status).toBe('available');
  });

  it('a failed table reconciliation keeps previously visible orders and tables', async () => {
    mock.read = async table => table === 'orders' ? [{ ...row('open'), total: 20, items: [{ id: 'i', subtotal: 20 }] }]
      : table === 'store_tables' ? [{ number: 1, status: 'occupied', order_id: 'open' }] : [];
    render(<StoreProvider><Probe /></StoreProvider>);
    await waitFor(() => expect(store.loading).toBe(false));
    mock.read = async table => { if (table === 'store_tables') throw new Error('offline'); return []; };
    await act(async () => { await store.fetchAll(); });
    expect(store.orders.find(o => o.id === 'open')?.total).toBe(20);
    expect(store.tables.find(t => t.number === 1)?.status).toBe('occupied');
  });
});