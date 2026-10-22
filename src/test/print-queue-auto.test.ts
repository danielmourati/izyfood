import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: mocks }));
vi.mock('@/lib/printer', () => ({ getDeviceId: () => 'caixa-A' }));
import { fetchOpenPrintJobs, claimPrintJob } from '@/lib/print-queue';

describe('automatic queue path', () => {
  beforeEach(() => vi.clearAllMocks());
  it('fetches failed and queued jobs but excludes successful/in-flight jobs', async () => {
    const rows = [
      { id: 'failed', status: 'error', attempts: 9, updated_at: '2020-01-01T00:00:00Z' },
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
});