import { describe, it, expect } from 'vitest';
import { needsAuthToRemoveItem, showsRemoveItemControl } from '@/lib/order-permissions';

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

describe('lixeira visível no pedido', () => {
  it('esconde a lixeira de item impresso para atendente sem permissão', () => {
    expect(showsRemoveItemControl({ printed: true }, false)).toBe(false);
  });
  it('mostra a lixeira de item impresso para quem tem permissão', () => {
    expect(showsRemoveItemControl({ printed: true }, true)).toBe(true);
  });
  it('mantém a lixeira de item ainda não enviado mesmo sem permissão', () => {
    expect(showsRemoveItemControl({ printed: false }, false)).toBe(true);
  });
});
