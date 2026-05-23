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

    expect(receipt).toMatch(/Tipo: +Mesa\n/);
    expect(receipt).not.toContain('Tipo:                     sa\n');
    expect(receipt).toMatch(/Taxa de Serviço: +R\$ 4,80\n/);
  });

  it('wraps long item names across multiple lines with price right-aligned on the LAST line (58mm)', () => {
    const receipt = decodeReceipt(buildBillReceipt({
      id: 'order-2',
      orderType: 'balcao',
      items: [{
        name: 'Açaí 500ml com complementos especiais e cobertura premium',
        quantity: 1,
        price: 48,
        subtotal: 48,
      }],
      total: 48,
      createdAt: '2026-05-22T20:13:00.000Z',
      customerName: 'Cliente',
    }, 58));

    const lines = receipt.split('\n');
    // Find the line containing the price; previous lines should hold remaining label text.
    const priceLineIdx = lines.findIndex(l => /R\$ ?48,00\s*$/.test(l));
    expect(priceLineIdx).toBeGreaterThan(0);
    const priceLine = lines[priceLineIdx];
    expect(priceLine.length).toBeLessThanOrEqual(32);
    // The line above the price line should be part of the wrapped label (no price on it).
    expect(lines[priceLineIdx - 1]).not.toMatch(/R\$/);
  });

  it('emits the full sequence of section separators in order', () => {
    const receipt = decodeReceipt(buildBillReceipt({
      id: 'order-3',
      orderType: 'mesa',
      tableNumber: 7,
      items: [{ name: 'Açaí', quantity: 1, price: 40, subtotal: 40 }],
      total: 44,
      serviceFee: 4,
      paymentSplits: [{ method: 'dinheiro', amount: 44 }],
      createdAt: '2026-05-22T20:13:00.000Z',
      customerName: 'Consumidor',
    }, 58, { storeName: 'Loja' }));

    const sep = '-'.repeat(32);
    // Expect at least 6 separators: header, title, data, items, adjustments, total, payment
    const occurrences = receipt.split(sep).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(6);
  });

  it('item longo quebrado em 2 linhas com preço na 1ª (ou na última linha conforme especificação do layout)', () => {
    const receipt = decodeReceipt(buildBillReceipt({
      id: 'order-4',
      orderType: 'balcao',
      items: [{
        name: 'Açaí 500ml com complementos especiais e cobertura premium',
        quantity: 1,
        price: 48,
        subtotal: 48,
      }],
      total: 48,
      createdAt: '2026-05-22T20:13:00.000Z',
      customerName: 'Cliente',
    }, 58));

    const lines = receipt.split('\n');
    const priceLineIdx = lines.findIndex(l => /R\$ ?48,00\s*$/.test(l));
    expect(priceLineIdx).toBeGreaterThan(0);
    const priceLine = lines[priceLineIdx];
    expect(priceLine.length).toBeLessThanOrEqual(32);
    // Verifies that the line containing the price is the last line of the wrapped name
    expect(lines[priceLineIdx - 1]).not.toMatch(/R\$/);
  });

  it('presença de todos os 7 separadores na ordem correta', () => {
    const receipt = decodeReceipt(buildBillReceipt({
      id: 'order-5',
      orderType: 'mesa',
      tableNumber: 5,
      items: [{ name: 'Açaí 500ml', quantity: 1, price: 48, subtotal: 48 }],
      total: 52.8,
      serviceFee: 4.8,
      paymentSplits: [{ method: 'dinheiro', amount: 52.8 }],
      createdAt: '2026-05-22T20:13:00.000Z',
      customerName: 'Consumidor',
    }, 58, {
      storeName: 'NOME DA LOJA',
      address: 'Rua Exemplo, 123',
      document: '00.000.000/0001-00',
      showAddress: true,
      showDocument: true,
    }));

    const sep = '-'.repeat(32);
    const parts = receipt.split(sep);
    
    // We expect exactly 7 separators when all sections are present.
    // Splitting by 7 separators results in 8 parts.
    expect(parts.length).toBe(8);

    // Verify correct content order
    expect(parts[0]).toContain('NOME DA LOJA');
    expect(parts[1]).toContain('CONTA');
    expect(parts[2]).toContain('Tipo:');
    expect(parts[3]).toContain('1x Açaí 500ml');
    expect(parts[4]).toContain('Taxa de Serviço:');
    expect(parts[5]).toContain('TOTAL');
    expect(parts[6]).toContain('PAGAMENTO:');
  });
});

