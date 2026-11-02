import { describe, it, expect, vi } from 'vitest';
import { collectPages, brazilDayBounds } from '@/lib/query-pages';

describe('period pagination', () => {
  it('reads beyond one page so money totals are not truncated', async () => {
    const rows = Array.from({ length: 1001 }, (_, id) => ({ id, total: 10 }));
    const read = vi.fn(async (offset: number, size: number) => ({ data: rows.slice(offset, offset + size), error: null }));
    const result = await collectPages(read);
    expect(result.reduce((sum, row) => sum + row.total, 0)).toBe(10010);
    expect(read).toHaveBeenCalledTimes(3);
    expect(new Set(result.map(r => r.id)).size).toBe(1001);
  });
  it('rejects rather than exposing partial totals when a later page fails', async () => {
    const read = vi.fn().mockResolvedValueOnce({ data: [1, 2], error: null }).mockResolvedValueOnce({ data: null, error: new Error('offline') });
    await expect(collectPages(read, 2)).rejects.toThrow('offline');
  });
  it('uses the whole Brazilian day even on a device with a different timezone', () => {
    expect(brazilDayBounds('2026-11-02')).toEqual({ from: '2026-11-02T03:00:00.000Z', to: '2026-11-03T02:59:59.999Z' });
  });
});