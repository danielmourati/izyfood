import { describe, it, expect } from 'vitest';
import { canCancelPrintJob } from '@/lib/print-queue';

const now = Date.parse('2026-10-19T12:00:00Z');
const ago = (s: number) => new Date(now - s * 1000).toISOString();

describe('cancelar cupons da fila', () => {
  it('cupom "Na fila" pode ser cancelado', () => {
    expect(canCancelPrintJob({ status: 'pending', claimed_at: null }, now)).toBe(true);
  });
  it('cupom que falhou pode ser cancelado', () => {
    expect(canCancelPrintJob({ status: 'error', claimed_at: null }, now)).toBe(true);
  });
  it('cupom travado imprimindo há mais de 60s pode ser cancelado', () => {
    expect(canCancelPrintJob({ status: 'printing', claimed_at: ago(61) }, now)).toBe(true);
  });
  it('cupom sendo impresso agora não pode ser cancelado', () => {
    expect(canCancelPrintJob({ status: 'printing', claimed_at: ago(5) }, now)).toBe(false);
  });
  it('cupom já impresso não pode ser cancelado', () => {
    expect(canCancelPrintJob({ status: 'done', claimed_at: ago(5) }, now)).toBe(false);
  });
});
