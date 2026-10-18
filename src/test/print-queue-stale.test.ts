import { describe, it, expect } from 'vitest';
import { isStalePrinting } from '@/lib/print-queue';

describe('isStalePrinting', () => {
  const now = Date.parse('2026-10-18T12:00:00Z');
  it('printing for more than 60s is stale', () => {
    expect(isStalePrinting({ status: 'printing', claimed_at: '2026-10-18T11:58:59Z' }, now)).toBe(true);
  });
  it('printing for 30s is not stale', () => {
    expect(isStalePrinting({ status: 'printing', claimed_at: '2026-10-18T11:59:30Z' }, now)).toBe(false);
  });
});
