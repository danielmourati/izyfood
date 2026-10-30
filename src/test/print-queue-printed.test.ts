import { describe, it, expect, beforeEach } from 'vitest';
import { canAutoPrintJob, canForcePrintJob, rememberJobSent, wasJobSent, getQueuedOrderIntent } from '@/lib/print-queue';

const base = { status: 'error' as const, claimed_at: null, attempts: 1, updated_at: new Date(0).toISOString() };
describe('cupom já impresso', () => {
  beforeEach(() => localStorage.clear());
  it('não volta para impressão automática', () => {
    expect(canAutoPrintJob({ ...base, printed_at: new Date().toISOString() })).toBe(false);
  });
  it('não pode ser forçado', () => {
    expect(canForcePrintJob({ status: 'error', claimed_at: null, printed_at: new Date().toISOString() })).toBe(false);
  });
  it('envio persistido não é repetido em outro aparelho sem histórico local', () => {
    expect(canAutoPrintJob({ ...base, dispatched_at: '2026-10-30T22:00:00Z' })).toBe(false);
    expect(canForcePrintJob({ ...base, dispatched_at: '2026-10-30T22:00:00Z' })).toBe(false);
  });
  it('recuperação automática usa intenção de reimpressão de uma via', () => {
    expect(getQueuedOrderIntent({ attempts: 2, payload: { __printIntent: 'new' } })).toBe('reprint');
    expect(getQueuedOrderIntent({ attempts: 1, payload: { __printIntent: 'new' } })).toBe('new');
  });
  it('enviado neste aparelho nunca é reenviado', () => {
    rememberJobSent('j1');
    expect(wasJobSent('j1')).toBe(true);
    expect(canAutoPrintJob({ ...base, status: 'pending', id: 'j1' })).toBe(false);
  });
});
