import { describe, it, expect } from 'vitest';
import { buildTransferSelection, isTableOccupiedError, tableMoveErrorMessage } from './transfer-items';

describe('transfer-items', () => {
  it('envia só itens com quantidade selecionada', () => {
    expect(buildTransferSelection({ a: 2, b: 0, c: 1 })).toEqual([{ id: 'a', qty: 2 }, { id: 'c', qty: 1 }]);
  });
  it('reconhece mesa de destino ocupada e nunca trata como falha de gravação', () => {
    const err = { message: 'Mesa 7 já está ocupada' };
    expect(isTableOccupiedError(err)).toBe(true);
    expect(tableMoveErrorMessage(err)).toBe('Mesa 7 já está ocupada.');
    expect(isTableOccupiedError({ message: 'order not found' })).toBe(false);
  });
});
