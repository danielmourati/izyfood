import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: mocks }));
vi.mock('@/lib/printer', () => ({ getDeviceId: () => 'caixa-A' }));
import { fetchOpenPrintJobs, claimPrintJob, canAutoPrintJob } from '@/lib/print-queue';

describe('automatic queue path', () => {
  beforeEach(() => vi.clearAllMocks());
  it('fetches failed and queued jobs but excludes successful/in-flight jobs', async () => {
    const rows = [
      { id: 'failed', status: 'error', attempts: 1, updated_at: new Date(Date.now() - 30_000).toISOString() },
      { id: 'queued', status: 'pending' },
      { id: 'done', status: 'done' },
      { id: 'busy', status: 'printing', claimed_at: new Date().toISOString() },
    ];
    const query = { select: vi.fn(), in: vi.fn(), order: vi.fn(), limit: vi.fn() };
    query.select.mockReturnValue(query);
    query.in.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockResolvedValue({ data: rows, error: null });
    mocks.from.mockReturnValue(query);
    expect((await fetchOpenPrintJobs()).map(job => job.id)).toEqual(['failed', 'queued']);
    expect(query.in).toHaveBeenCalledWith('status', ['pending', 'printing', 'error']);
  });
  it('requires the owning device when claiming a queued or failed cupom', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    expect(await claimPrintJob('job-1', 'Caixa A')).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledWith('claim_print_job_for_host', { _job_id: 'job-1', _claimed_by: 'Caixa A', _device_id: 'caixa-A' });
  });
  it('stops automatic retries after 3 failed attempts', () => {
    const now = Date.now();
    const updated_at = new Date(now - 120_000).toISOString();
    expect(canAutoPrintJob({ status: 'error', attempts: 2, claimed_at: null, updated_at }, now)).toBe(true);
    expect(canAutoPrintJob({ status: 'error', attempts: 3, claimed_at: null, updated_at }, now)).toBe(false);
  });
  it('never auto-prints jobs idle for more than 10 minutes', () => {
    const now = Date.now();
    const old = new Date(now - 11 * 60_000).toISOString();
    expect(canAutoPrintJob({ status: 'pending', attempts: 0, claimed_at: null, updated_at: old }, now)).toBe(false);
    expect(canAutoPrintJob({ status: 'error', attempts: 1, claimed_at: null, updated_at: old }, now)).toBe(false);
  });
});
