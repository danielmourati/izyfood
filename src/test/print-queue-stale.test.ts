import { describe, it, expect } from 'vitest';
import { isStalePrinting, canForcePrintJob } from '@/lib/print-queue';

describe('isStalePrinting', () => {
  const now = Date.parse('2026-10-18T12:00:00Z');
  it('printing for more than 60s is stale', () => {
    expect(isStalePrinting({ status: 'printing', claimed_at: '2026-10-18T11:58:59Z' }, now)).toBe(true);
  });
  it('printing for 30s is not stale', () => {
    expect(isStalePrinting({ status: 'printing', claimed_at: '2026-10-18T11:59:30Z' }, now)).toBe(false);
  });
});

describe('canForcePrintJob', () => {
  const now = Date.parse('2026-10-18T12:00:00Z');
  it('pending jobs can be forced', () => {
    expect(canForcePrintJob({ status: 'pending', claimed_at: null }, now)).toBe(true);
  });
  it('failed jobs can be forced', () => {
    expect(canForcePrintJob({ status: 'error', claimed_at: null }, now)).toBe(true);
  });
  it('stale printing jobs can be forced', () => {
    expect(canForcePrintJob({ status: 'printing', claimed_at: '2026-10-18T11:58:00Z' }, now)).toBe(true);
  });
  it('fresh printing jobs cannot be forced', () => {
    expect(canForcePrintJob({ status: 'printing', claimed_at: '2026-10-18T11:59:45Z' }, now)).toBe(false);
  });
  it('done jobs cannot be forced', () => {
    expect(canForcePrintJob({ status: 'done', claimed_at: null }, now)).toBe(false);
  });
});
