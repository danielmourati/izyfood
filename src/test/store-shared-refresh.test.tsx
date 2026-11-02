import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreProvider, useStore } from '@/contexts/StoreContext';

const mock = vi.hoisted(() => ({
  user: { id: 'user-a', tenantId: 'tenant-a', tenantSlug: 'test' },
  counts: {} as Record<string, number>,
  handlers: {} as Record<string, () => void>,
  read: null as null | ((table: string, count: number) => Promise<unknown[]>),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mock.user }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'order', 'eq', 'or', 'is', 'limit', 'maybeSingle']) builder[method] = () => builder;
    builder.then = (resolve: (value: unknown) => void, reject: (error: unknown) => void) => {
      const count = mock.counts[table] = (mock.counts[table] || 0) + 1;
      return (mock.read?.(table, count) ?? Promise.resolve([])).then(data => resolve({ data, error: null }), reject);
    };
    return builder;
  },
  channel: () => {
    const channel = {
      on: (_event: string, filter: { table?: string }, handler: () => void) => {
        if (filter.table) mock.handlers[filter.table] = handler;
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
  mock.counts = {}; mock.handlers = {}; mock.read = null;
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
    act(() => { mock.handlers.orders(); mock.handlers.store_tables(); });
    await act(async () => { pending.resolve([row('stale')]); await Promise.all([first, second]); });
    expect(mock.counts.orders).toBe(2);
    expect(mock.counts.store_tables).toBe(2);
    expect(store.orders.map(o => o.id)).toEqual(['fresh']);
    await new Promise(resolve => setTimeout(resolve, 350));
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
    await act(async () => { pending.resolve([row('tenant-a-order')]); });
    expect(store.orders.map(o => o.id)).toEqual(['tenant-b-order']);
    expect(mock.counts.orders).toBe(2);
  });
});