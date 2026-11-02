import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readPeriodSales } from '@/lib/period-sales';

const mock = vi.hoisted(() => ({ queries: [] as { table: string; args: Record<string, unknown[]> }[], fail: false }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: (table: string) => {
    const args: Record<string, unknown[]> = {};
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'gte', 'lte', 'order', 'range', 'in', 'abortSignal']) builder[method] = (...values: unknown[]) => { args[`${method}:${values[0]}`] = values.slice(1); return builder; };
    builder.then = (resolve: (value: unknown) => void) => {
      mock.queries.push({ table, args });
      const data = table === 'sales'
        ? [{ id: 'sale', order_id: 'order', total: 40, payment_method: 'pix', date: '2026-11-01T05:00:00Z', items: [] }]
        : [{ id: 'order', opened_by: 'attendant', opened_by_name: 'Ana', order_type: 'mesa', service_fee: 4 }];
      return Promise.resolve(resolve({ data: mock.fail && table === 'orders' ? null : data, error: mock.fail && table === 'orders' ? new Error('offline') : null }));
    };
    return builder;
  },
} }));
beforeEach(() => { mock.queries = []; mock.fail = false; });

describe('period sale reads', () => {
  it('preserves before-midnight register sales and historical opener/service fee without loading full orders', async () => {
    const result = await readPeriodSales('tenant', '2026-11-01T03:00:00.000Z', '2026-11-03T02:59:59.999Z');
    expect(result.sales[0].total).toBe(40);
    expect(result.orders[0]).toEqual({ id: 'order', openedBy: 'attendant', openedByName: 'Ana', orderType: 'mesa', serviceFee: 4 });
    expect(mock.queries[0].args['gte:date']).toEqual(['2026-11-01T03:00:00.000Z']);
    expect(mock.queries[0].args['lte:date']).toEqual(['2026-11-03T02:59:59.999Z']);
    expect(mock.queries.every(q => q.args['eq:tenant_id']?.[0] === 'tenant')).toBe(true);
    expect(mock.queries[1].args['in:id']).toEqual([['order']]);
  });
  it('does not expose sales as a complete fee/commission report if the linked-order query fails', async () => {
    mock.fail = true;
    await expect(readPeriodSales('tenant', '2026-11-01', '2026-11-03')).rejects.toThrow('offline');
  });
});