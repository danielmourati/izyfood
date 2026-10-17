import { describe, expect, it } from 'vitest';
import { buildBillReceipt, buildCashCloseReceipt, buildOrderReceipt, receiptColumnsForWidth } from '@/lib/escpos';
import { decodeText } from '@/lib/escpos-encoding';
import { wrapReceiptText } from '@/lib/receipt-layout';
import { receiptHtml, receiptLines, receiptPlainText } from '@/lib/receipt-renderer';
import { buildBillPreviewText } from '@/lib/receipt-preview';
import { buildBillHtml, buildCashCloseHtml, buildOrderHtml } from '@/hooks/use-printer';

const order = {
  id: 'real-layout', orderType: 'mesa', tableNumber: 2,
  createdAt: '2026-10-12T18:00:00Z', openedByName: 'João Atendente',
  customerName: '<img src=x onerror=alert(1)>', total: 44,
  pickupNotes: 'Sem cebola\nMolho à parte', serviceFee: 4,
  paymentSplits: [{ method: 'pix', amount: 20 }, { method: 'dinheiro', amount: 24 }],
  items: [
    { name: 'Açaí especial com nome muito comprido', quantity: 2, price: 20, subtotal: 40,
      selectedComplements: [{ name: 'Chocolateextraordinariamentelongo', quantity: 1, price: 0 }] },
  ],
};
const cash = {
  openedAt: order.createdAt, closedAt: '2026-10-12T19:00:00Z',
  operatorName: 'Operador com nome extraordinariamente longo', initialAmount: 50,
  totalCash: 24, totalPix: 20, totalCard: 0, totalFiado: 0, totalSales: 44,
};

describe('shared Menuzin-style receipt layout', () => {
  it.each([[55, 32], [58, 32], [80, 42]])('uses the required capacity for %imm', (width, cols) => {
    expect(receiptColumnsForWidth(width)).toBe(cols);
    for (const bytes of [buildOrderReceipt(order, width, {}, 'utf8'), buildBillReceipt(order, width, {}, 'utf8'), buildCashCloseReceipt(cash, width, 'utf8')]) {
      expect(receiptLines(bytes).some(line => line.text === '-'.repeat(cols))).toBe(true);
    }
  });
  it.each([55, 58, 80])('bounds all coupon lines for %imm, including doubled text', width => {
    const cols = receiptColumnsForWidth(width);
    for (const doubleFontOrders of [false, true]) {
      for (const bytes of [buildOrderReceipt(order, width, { doubleFontOrders }, 'utf8'), buildBillReceipt(order, width, {}, 'utf8'), buildCashCloseReceipt(cash, width, 'utf8')]) {
        for (const line of receiptLines(bytes)) expect(line.text.length).toBeLessThanOrEqual(line.double ? Math.floor(cols / 2) : cols);
      }
    }
  });
  it.each([55, 80])('reuses the same lines in HTML, text and thermal output for %imm', width => {
    const cols = receiptColumnsForWidth(width);
    const bytes = buildBillReceipt(order, width, {}, 'utf8');
    expect(buildBillHtml(order, {}, width)).toBe(receiptHtml(bytes, cols));
    expect(buildBillPreviewText(order, width)).toBe(receiptPlainText(bytes, cols));
    expect(buildOrderHtml(order, { doubleFontOrders: true }, width)).toBe(receiptHtml(buildOrderReceipt(order, width, { doubleFontOrders: true }, 'utf8'), cols));
    expect(buildCashCloseHtml(cash, width)).toBe(receiptHtml(buildCashCloseReceipt(cash, width, 'utf8'), cols));
  });
  it('escapes all HTML content and preserves accents', () => {
    const html = buildBillHtml(order);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('João');
    expect(html).toContain('Açaí');
  });
  it('hyphenates only oversized words and retains hanging indent', () => {
    expect(wrapReceiptText('Produto com nome', 13, '1x ', 3)).toEqual(['1x Produto', '   com nome']);
    const lines = wrapReceiptText('Superextraordinariamentecomprido', 13, '1x ', 3);
    expect(lines[0]).toMatch(/-$/);
    expect(lines.every(line => line.length <= 13)).toBe(true);
    expect(lines.slice(1).every(line => line.startsWith('   '))).toBe(true);
  });
  it('preserves recorded subtotals and split payments without adding addon prices twice', () => {
    const bill = { ...order, items: [{ ...order.items[0], price: 18, subtotal: 40, selectedComplements: [{ name: 'Extra', quantity: 1, price: 2 }] }] };
    const text = buildBillPreviewText(bill, 80);
    expect(text).toContain('Unit: R$18,00  Total: R$40,00');
    expect(text).toContain('TOTAL: R$44,00');
    expect(text).toMatch(/PIX +R\$20,00/);
    expect(text).toMatch(/Dinheiro +R\$24,00/);
    const calibrated = decodeText(buildBillReceipt(bill, 80, {}, 'cp860_bematech'), 'cp860_bematech');
    expect(calibrated).toContain('Açaí');
  });
});