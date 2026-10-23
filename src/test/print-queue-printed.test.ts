import { describe, it, expect, beforeEach } from 'vitest';
import { canAutoPrintJob, canForcePrintJob, rememberJobSent, wasJobSent } from '@/lib/print-queue';

const base = { status: 'error' as const, claimed_at: null, attempts: 1, updated_at: new Date(0).toISOString() };
describe('cupom já impresso', () => {
  beforeEach(() => localStorage.clear());
  it('não volta para impressão automática', () => {
    expect(canAutoPrintJob({ ...base, printed_at: new Date().toISOString() })).toBe(false);
  });
  it('não pode ser forçado', () => {
    expect(canForcePrintJob({ status: 'error', claimed_at: null, printed_at: new Date().toISOString() })).toBe(false);
  });
  it('enviado neste aparelho nunca é reenviado', () => {
    rememberJobSent('j1');
    expect(wasJobSent('j1')).toBe(true);
    expect(canAutoPrintJob({ ...base, status: 'pending', id: 'j1' })).toBe(false);
  });
});
