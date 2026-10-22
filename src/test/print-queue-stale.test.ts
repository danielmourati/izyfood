import { describe, it, expect } from 'vitest';
import { isStalePrinting, canForcePrintJob, canAutoPrintJob } from '@/lib/print-queue';

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

describe('automatic failed-job recovery', () => {
  const now = Date.parse('2026-10-22T03:00:00Z');
  const failed = { status: 'error' as const, claimed_at: null, attempts: 1, updated_at: new Date(now - 10_000).toISOString() };
  it('retries failed jobs automatically after their delay', () => {
    expect(canAutoPrintJob(failed, now)).toBe(true);
  });
  it('does not immediately loop a recent failure', () => {
    expect(canAutoPrintJob({ ...failed, updated_at: new Date(now - 9_999).toISOString() }, now)).toBe(false);
  });
  it('continues recovering errors beyond the old three-attempt limit', () => {
    expect(canAutoPrintJob({ ...failed, attempts: 4, updated_at: new Date(now - 60_000).toISOString() }, now)).toBe(true);
  });
  it('never automatically reprints a successful job', () => {
    expect(canAutoPrintJob({ ...failed, status: 'done' }, now)).toBe(false);
  });
  it('does not reprint a job currently printing', () => {
    expect(canAutoPrintJob({ ...failed, status: 'printing', claimed_at: new Date(now - 30_000).toISOString() }, now)).toBe(false);
  });
  it('keeps queued jobs eligible for immediate printing', () => {
    expect(canAutoPrintJob({ ...failed, status: 'pending' }, now)).toBe(true);
  });
});
