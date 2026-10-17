import { describe, it, expect } from 'vitest';
import { isHostAlive } from '@/lib/print-host-presence';

describe('Caixa ativo pelo sinal de vida', () => {
  const now = Date.parse('2026-10-17T20:00:00Z');
  it('ativo com sinal de 30 s atrás', () => {
    expect(isHostAlive(new Date(now - 30_000).toISOString(), now)).toBe(true);
  });
  it('inativo com sinal de 46 s atrás', () => {
    expect(isHostAlive(new Date(now - 46_000).toISOString(), now)).toBe(false);
  });
  it('inativo sem sinal', () => {
    expect(isHostAlive(null, now)).toBe(false);
  });
});
