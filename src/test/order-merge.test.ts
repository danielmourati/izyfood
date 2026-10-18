import { describe, it, expect } from 'vitest';
import { mergeOrderItems, isTerminalStatus, absorbDuplicateOrderItems, pickTableOrder, canDeleteOrder, allowOrderDelete, consumeOrderDelete } from '@/lib/order-merge';

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

describe('um pedido aberto por mesa', () => {
  it('itens do pedido duplicado entram no pedido que já existe, sem repetir', () => {
    const r = absorbDuplicateOrderItems([{ id: 'g1' }, { id: 'g2' }], [{ id: 'a1' }, { id: 'g1' }]);
    expect(r.map(i => i.id)).toEqual(['g1', 'g2', 'a1']);
  });
  it('cartão da mesa usa o pedido para o qual a mesa aponta', () => {
    const orders = [
      { id: 'velho', orderType: 'mesa', tableNumber: 20, status: 'aberto', createdAt: '2026-10-18T00:01:00Z', items: [{}] },
      { id: 'novo', orderType: 'mesa', tableNumber: 20, status: 'aberto', createdAt: '2026-10-18T00:10:00Z', items: [{}] },
    ];
    expect(pickTableOrder(orders, 20, 'velho')?.id).toBe('velho');
    expect(pickTableOrder(orders, 20, undefined)?.id).toBe('novo');
  });
  it('pedido finalizado não aparece no cartão da mesa', () => {
    const orders = [{ id: 'x', orderType: 'mesa', tableNumber: 2, status: 'finalizado', items: [{}] }];
    expect(pickTableOrder(orders, 2, 'x')).toBeUndefined();
  });
});

describe('exclusão de pedidos', () => {
  it('bloqueia apagar pedido com itens no banco sem ordem explícita', () => {
    expect(canDeleteOrder({ items: [{}], total: 20 }, false)).toBe(false);
  });
  it('bloqueia apagar pedido com valor mesmo sem itens', () => {
    expect(canDeleteOrder({ items: [], total: 15 }, false)).toBe(false);
  });
  it('permite apagar rascunho vazio', () => {
    expect(canDeleteOrder({ items: [], total: 0 }, false)).toBe(true);
  });
  it('permite apagar pedido com itens quando o usuário confirmou', () => {
    expect(canDeleteOrder({ items: [{}], total: 20 }, true)).toBe(true);
  });
  it('autorização de exclusão vale uma única vez', () => {
    allowOrderDelete('p1');
    expect(consumeOrderDelete('p1')).toBe(true);
    expect(consumeOrderDelete('p1')).toBe(false);
  });
});

import { allowItemRemoval, consumeItemRemovals } from '@/lib/order-merge';
describe('remoção explícita de itens', () => {
  it('só itens tocados na lixeira são liberados para remoção, uma vez', () => {
    allowItemRemoval('o1', 'i1');
    expect(consumeItemRemovals('o1')).toEqual(['i1']);
    expect(consumeItemRemovals('o1')).toEqual([]);
  });
});
