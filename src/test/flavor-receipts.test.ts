import { describe, expect, it } from 'vitest';
import { buildBillReceipt, buildOrderReceipt, kitchenItemColumns } from '@/lib/escpos';
import { receiptLines, receiptPlainText, receiptHtml } from '@/lib/receipt-renderer';
import { getOrderItemCustomizationGroups } from '@/lib/utils';

const order = {
  id: 'flavors-test', orderType: 'mesa', tableNumber: 2, total: 24,
  openedByName: 'Ana', createdAt: '2026-10-12T19:00:00Z',
  items: [{ name: 'Pastel', price: 20, subtotal: 24, quantity: 1,
    selectedComplements: [
      { name: 'Carne', price: 0, quantity: 1, classification: 'flavor' as const },
      { name: 'Queijo', price: 0, quantity: 1, classification: 'flavor' as const },
      { name: 'Azeitona', price: 0, quantity: 1, classification: 'additional' as const },
      { name: 'Bacon', price: 2, quantity: 2, classification: 'additional' as const },
    ],
  }],
};

describe('flavor and additional receipts', () => {
  it.each([55, 58, 80])('keeps groups bold and quantities correct at %s mm', width => {
    for (const doubleFontOrders of [false, true]) {
      for (const bytes of [buildOrderReceipt(order, width, { doubleFontOrders }, 'utf8'), buildBillReceipt(order, width, undefined, 'utf8')]) {
        const plain = receiptPlainText(bytes, width <= 58 ? 32 : 42);
        expect(plain).toContain('Sabores:');
        expect(plain).toContain('Adicionais:');
        expect(plain).toContain('- Carne');
        expect(plain).toContain('- Queijo');
        expect(plain).toContain('- Azeitona');
        expect(plain).toContain('- 2x Bacon');
        expect(plain).not.toMatch(/1x (Carne|Queijo|Azeitona)/);
        const lines = receiptLines(bytes);
        expect(lines.filter(line => /Sabores:|Adicionais:/.test(line.text)).every(line => line.bold)).toBe(true);
        expect(receiptHtml(bytes, width <= 58 ? 32 : 42)).toContain('Sabores:');
        for (const line of lines.filter(line => line.double)) expect(line.text.length).toBeLessThanOrEqual(kitchenItemColumns(width, true));
      }
    }
  });
  it('does not reclassify historical items or show empty groups', () => {
    expect(getOrderItemCustomizationGroups({ selectedComplements: [{ name: 'Carne', quantity: 1, price: 0 }] }).map(group => group.title)).toEqual(['Adicionais:']);
    expect(getOrderItemCustomizationGroups({})).toEqual([]);
    const snapshot = JSON.parse(JSON.stringify(order.items[0]));
    expect(getOrderItemCustomizationGroups(snapshot)[0].items).toHaveLength(2);
  });
});