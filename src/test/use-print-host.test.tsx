import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  printBill: vi.fn(), printOrder: vi.fn(), printCashClose: vi.fn(),
  claimPrintJob: vi.fn(), fetchOpenPrintJobs: vi.fn(), beginPrintJobDispatch: vi.fn(),
  markPrintJobDone: vi.fn(), markPrintJobError: vi.fn(),
  flushPendingDoneMarks: vi.fn(), purgeOldPrintJobs: vi.fn(), rpc: vi.fn(),
  sent: new Set<string>(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { tenantId: 'tenant-test', name: 'Admin' } }) }));
vi.mock('@/hooks/use-printer', () => ({ usePrinter: () => ({ printHostEnabled: true, printHostRequested: true, hasPrinterAvailable: true, printBill: m.printBill, printOrder: m.printOrder, printCashClose: m.printCashClose }) }));
vi.mock('@/lib/printer', () => ({ consumeLastPrinterUsed: () => 'Cozinha', getDeviceId: () => 'device-test', getDeviceLabel: () => 'Caixa' }));
vi.mock('@/lib/print-host-presence', () => ({ printHostPresence: { setHost: () => () => {} } }));
vi.mock('@/lib/print-queue', () => ({ ...m, wasJobSent: (id: string) => m.sent.has(id), getQueuedOrderIntent: () => 'reprint' }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  rpc: m.rpc, getChannels: () => [], removeChannel: vi.fn(),
  channel: () => { const c = { on: () => c, subscribe: () => c }; return c; },
} }));
import { usePrintHost } from '@/hooks/use-print-host';

describe('automatic recovery host', () => {
  beforeEach(() => {
    vi.clearAllMocks(); m.sent.clear();
    m.fetchOpenPrintJobs.mockResolvedValue([{ id: 'recovered-bill' }]);
    m.claimPrintJob.mockResolvedValue({ id: 'recovered-bill', kind: 'bill', payload: {}, attempts: 2 });
    m.beginPrintJobDispatch.mockImplementation(async id => { m.sent.add(id); });
    m.markPrintJobDone.mockResolvedValue(true);
  });
  it('prints a recovered bill once and only acknowledges it after acceptance', async () => {
    m.printBill.mockImplementation(async (_payload, options) => { await options.beforeDispatch(); return { ok: true, channel: 'qz' }; });
    const h = renderHook(() => usePrintHost());
    await waitFor(() => expect(m.markPrintJobDone).toHaveBeenCalledWith('recovered-bill', 'Cozinha'));
    expect(m.printBill).toHaveBeenCalledTimes(1);
    expect(m.markPrintJobError).not.toHaveBeenCalled();
    h.unmount();
  });
  it('ambiguous printer rejection after dispatch finishes without becoming retryable', async () => {
    m.printBill.mockImplementation(async (_payload, options) => { await options.beforeDispatch(); throw new Error('response lost'); });
    const h = renderHook(() => usePrintHost());
    await waitFor(() => expect(m.markPrintJobDone).toHaveBeenCalledTimes(1));
    expect(m.markPrintJobError).not.toHaveBeenCalled();
    expect(m.printBill).toHaveBeenCalledTimes(1);
    h.unmount();
  });
  it('pre-dispatch failure remains safe to retry', async () => {
    m.printBill.mockRejectedValue(new Error('printer not found'));
    const h = renderHook(() => usePrintHost());
    await waitFor(() => expect(m.markPrintJobError).toHaveBeenCalledWith('recovered-bill', 'printer not found'));
    expect(m.markPrintJobDone).not.toHaveBeenCalled();
    h.unmount();
  });
});