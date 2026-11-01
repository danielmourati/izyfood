import { describe, it, expect } from 'vitest';
import { OrderOutbox, overlayPendingOrder, reconcilePendingOrders } from './order-outbox';
import type { Order, OrderItem } from '@/types';

const item = (id: string, printed = false): OrderItem => ({ id, productId: id, name: id, price: 20, quantity: 1, subtotal: 20, printed });
const order = (items: OrderItem[]): Order => ({ id: 'order', orderType: 'mesa', tableNumber: 16, status: 'aberto', createdAt: '2026-11-01T15:00:00Z', items, total: items.length * 20 });
const storage = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
};

describe('Zezinho durable table writes', () => {
  it('keeps launched items across network failure and reopening the app', () => {
    const disk = storage();
    new OrderOutbox(disk, 'zezinho').enqueue(order([item('new')]), order([]));
    const reopened = new OrderOutbox(disk, 'zezinho');
    expect(reconcilePendingOrders([order([])], reopened.list())[0].items.map(i => i.id)).toEqual(['new']);
    expect(reopened.list()).toHaveLength(1);
  });
  it('does not erase a newer printed-state save when an earlier request succeeds', () => {
    const box = new OrderOutbox(storage(), 'zezinho');
    const first = box.enqueue(order([item('new')]), order([]));
    box.enqueue(order([item('new', true)]), order([item('new')]));
    box.acknowledge(first);
    expect(box.list()[0].order.items[0].printed).toBe(true);
  });
  it('preserves pending printed items and items launched by another device', () => {
    const box = new OrderOutbox(storage(), 'zezinho');
    const pending = box.enqueue(order([item('new', true)]), order([]));
    expect(overlayPendingOrder(order([item('other')]), pending).items).toEqual([item('other'), item('new', true)]);
  });
  it('does not restore an explicitly removed item after reconnection', () => {
    const box = new OrderOutbox(storage(), 'zezinho');
    box.enqueue(order([]), order([item('removed')]), ['removed']);
    expect(reconcilePendingOrders([order([item('removed')])], box.list())[0].items).toEqual([]);
  });
  it('does not resurrect unchanged items removed or transferred on another device', () => {
    const box = new OrderOutbox(storage(), 'zezinho');
    const pending = box.enqueue(order([item('old'), item('new')]), order([item('old')]));
    expect(overlayPendingOrder(order([]), pending).items.map(i => i.id)).toEqual(['new']);
  });
  it('never reopens an order paid on another device', () => {
    const box = new OrderOutbox(storage(), 'zezinho');
    const pending = box.enqueue(order([item('new')]), order([]));
    const paid = { ...order([]), status: 'finalizado' as const };
    expect(overlayPendingOrder(paid, pending)).toEqual(paid);
  });
  it('separates pending orders by tenant', () => {
    const disk = storage();
    new OrderOutbox(disk, 'zezinho').enqueue(order([item('new')]));
    expect(new OrderOutbox(disk, 'other').list()).toEqual([]);
  });
  it('removes only the confirmed write and never queues printing during recovery', () => {
    const box = new OrderOutbox(storage(), 'zezinho');
    const write = box.enqueue(order([item('new', true)]));
    box.acknowledge(write);
    expect(box.list()).toEqual([]);
  });
  it('refuses to pretend an item is durable when device storage is full', () => {
    const box = new OrderOutbox({ getItem: () => null, setItem: () => { throw new Error('quota'); } }, 'zezinho');
    expect(() => box.enqueue(order([item('new')]))).toThrow('quota');
  });
});