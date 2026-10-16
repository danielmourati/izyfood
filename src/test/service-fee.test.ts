import { describe, it, expect } from 'vitest';
import { computeServiceFee } from '@/lib/utils';
import { buildBillReceipt } from '@/lib/escpos';
import { receiptPlainText } from '@/lib/receipt-renderer';

const products = [{ id: 'a' }, { id: 'b', serviceFeeExempt: true }];

describe('taxa de serviço', () => {
  it('10% sobre R$ 168,00 = R$ 16,80', () => {
    expect(computeServiceFee({ orderType: 'mesa', items: [{ productId: 'a', subtotal: 168 }] }, products, 10)).toBe(16.8);
  });
  it('item isento fica fora', () => {
    expect(computeServiceFee({ orderType: 'mesa', items: [{ productId: 'a', subtotal: 100 }, { productId: 'b', subtotal: 50 }] }, products, 10)).toBe(10);
  });
  it('balcão não paga taxa', () => {
    expect(computeServiceFee({ orderType: 'balcao', items: [{ productId: 'a', subtotal: 100 }] }, products, 10)).toBe(0);
  });
  it('percentual 0 não cobra', () => {
    expect(computeServiceFee({ orderType: 'mesa', items: [{ productId: 'a', subtotal: 100 }] }, products, 0)).toBe(0);
  });
  it('conta impressa mostra taxa', () => {
    const bill = { id: 'x', orderType: 'mesa', tableNumber: 2, createdAt: new Date().toISOString(), total: 168, serviceFee: 16.8,
      items: [{ name: 'Prato', quantity: 1, price: 168, subtotal: 168 }] };
    const txt = receiptPlainText(buildBillReceipt(bill as any, 80, {}, 'utf8'), 40);
    expect(txt).toContain('16,80');
    expect(txt).toContain('184,80');
  });
});
