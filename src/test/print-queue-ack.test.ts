import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: mocks }));
import { markPrintJobDone, flushPendingDoneMarks, wasJobSent } from '@/lib/print-queue';

describe('completion acknowledgement', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
  it('keeps acknowledgement after rejected network requests and retries only the mark', async () => {
    const update = { eq: vi.fn().mockRejectedValue(new Error('offline')) };
    const deletion = { eq: vi.fn() };
    deletion.eq.mockReturnValue(deletion);
    mocks.from.mockReturnValue({ update: () => update, delete: () => deletion });
    expect(await markPrintJobDone('job-ack', 'Cozinha', [])).toBe(false);
    expect(wasJobSent('job-ack')).toBe(true);
    expect(JSON.parse(localStorage.getItem('degust:print-jobs-done-pending') || '{}')).toEqual({ 'job-ack': 'Cozinha' });
    update.eq.mockResolvedValue({ error: null });
    await flushPendingDoneMarks();
    expect(update.eq).toHaveBeenCalledTimes(2);
    expect(JSON.parse(localStorage.getItem('degust:print-jobs-done-pending') || '{}')).toEqual({});
  });
});