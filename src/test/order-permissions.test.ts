import { describe, it, expect } from 'vitest';
import { needsAuthToRemoveItem } from '@/lib/order-permissions';

describe('remoção de itens impressos', () => {
  it('item impresso exige autorização sem permissão', () => {
    expect(needsAuthToRemoveItem({ printed: true }, false)).toBe(true);
  });
  it('item impresso sai direto com permissão', () => {
    expect(needsAuthToRemoveItem({ printed: true }, true)).toBe(false);
  });
  it('item novo sai direto mesmo sem permissão', () => {
    expect(needsAuthToRemoveItem({ printed: false }, false)).toBe(false);
  });
});
