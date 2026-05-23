import { describe, expect, it } from 'vitest';
import { buildBillReceipt } from '@/lib/escpos';

const decodeReceipt = (data: Uint8Array) => new TextDecoder().decode(data);

describe('ESC/POS bill receipt', () => {
  it('prints Tipo as complete Mesa value on its own aligned row', () => {
    const receipt = decodeReceipt(buildBillReceipt({
      id: 'order-1',
      orderType: 'mesa',
      tableNumber: 5,
      items: [{ name: 'Açaí', quantity: 1, price: 48, subtotal: 48 }],
      total: 52.8,
      serviceFee: 4.8,
      createdAt: '2026-05-22T20:13:00.000Z',
      customerName: 'Consumidor',
    }, 58));

    expect(receipt).toContain('Tipo:                     Mesa\n');
    expect(receipt).not.toContain('Tipo:                     sa\n');
    expect(receipt).toContain('Taxa de Serviço:       R$ 4,80\n');
  });
});