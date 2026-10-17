import { describe, it, expect } from 'vitest';
import { mergeOrderItems, isTerminalStatus } from '@/lib/order-merge';

describe('mescla de itens entre aparelhos', () => {
  it('preserva item gravado por outro aparelho', () => {
    const r = mergeOrderItems([{ id: 'a' }], [{ id: 'a' }], [{ id: 'a' }, { id: 'b' }]);
    expect(r.map(i => i.id)).toEqual(['a', 'b']);
  });
  it('item removido neste aparelho não volta', () => {
    const r = mergeOrderItems([{ id: 'a' }], [{ id: 'a' }, { id: 'b' }], [{ id: 'a' }, { id: 'b' }]);
    expect(r.map(i => i.id)).toEqual(['a']);
  });
  it('pedido finalizado é terminal', () => {
    expect(isTerminalStatus('finalizado')).toBe(true);
    expect(isTerminalStatus('aberto')).toBe(false);
  });
});
