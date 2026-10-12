import { describe, expect, it, vi } from 'vitest';
import { encodeText, getCharEncoding, isValidCharEncoding } from '@/lib/escpos-encoding';
import { buildBillReceipt, buildOrderReceipt, buildCashCloseReceipt, buildEncodingTestReceipt, buildEncodingVerificationReceipt } from '@/lib/escpos';
import { receiptLines } from '@/lib/receipt-renderer';
import { printViaDesktopSpooler, printViaDesktopSocket } from '@/lib/printer-desktop';

const order = { id: 'accent-test', orderType: 'mesa', tableNumber: 1, openedByName: 'José', createdAt: '2026-10-12T19:00:00Z', total: 10, pickupNotes: 'Ação Maçã Café', items: [{ name: 'Açaí', quantity: 1, price: 10, subtotal: 10, selectedComplements: [{ name: 'Maçã', quantity: 1, price: 0 }] }] };

describe('physical character calibration', () => {
  it.each([
    ['cp850', [0x87, 0xc6, 0x82, 0x80, 0xc7, 0x90]],
    ['cp860', [0x87, 0x84, 0x82, 0x80, 0x8e, 0x90]],
    ['cp1252', [0xe7, 0xe3, 0xe9, 0xc7, 0xc3, 0xc9]],
  ])('encodes exact reference bytes for %s, including decomposed accents', (table, expected) => {
    expect(Array.from(encodeText('çãéÇÃÉ', `${table}@17`))).toEqual(expected);
    expect(Array.from(encodeText('çãéÇÃÉ'.normalize('NFD'), `${table}@17`))).toEqual(expected);
    expect(Array.from(getCharEncoding(`${table}@17`).command)).toEqual([27, 116, 17]);
  });
  it.each(['cp850@0', 'cp860@255', 'cp1252@16', 'cp850', 'utf8'])('accepts supported settings: %s', id => expect(isValidCharEncoding(id)).toBe(true));
  it.each(['cp850@256', 'cp860@-1', 'cp850@1.5', 'cp850@', 'unknown@2'])('rejects invalid settings: %s', id => expect(isValidCharEncoding(id)).toBe(false));
  it('does not claim ESC t 8 activates Unicode', () => {
    expect(getCharEncoding('utf8').command.length).toBe(0);
    expect(Array.from(encodeText('çãé', 'utf8'))).toEqual([195, 167, 195, 163, 195, 169]);
  });
  it('applies custom calibration to kitchen, bill, cash and saved verification sample', () => {
    const encoding = 'cp860@17';
    const cash = { openedAt: order.createdAt, closedAt: order.createdAt, operatorName: 'José', initialAmount: 0, totalCash: 10, totalPix: 0, totalCard: 0, totalFiado: 0, totalSales: 10 };
    for (const bytes of [buildOrderReceipt(order, 55, {}, encoding), buildBillReceipt(order, 55, {}, encoding), buildCashCloseReceipt(cash, 55, encoding), buildEncodingVerificationReceipt(55, encoding)]) {
      expect(Array.from(bytes).join(',')).toContain('27,116,17');
      expect(Array.from(bytes)).toContain(0x82);
    }
    expect(Array.from(buildOrderReceipt(order, 55, {}, encoding))).toContain(0x84);
  });
  it('isolates every calibration sample with reset and bounds printed lines', () => {
    const bytes = buildEncodingTestReceipt(55, 'cp860@17');
    const resets = Array.from(bytes).filter((b, i) => b === 27 && bytes[i + 1] === 64).length;
    expect(resets).toBe(39); // 37 samples + page start and end
    expect(Array.from(bytes).join(',')).toContain('27,116,48');
    for (const line of receiptLines(bytes)) expect(line.text.length).toBeLessThanOrEqual(32);
  });
  it('hands native transports the same bytes without Unicode conversion', async () => {
    const printRaw = vi.fn().mockResolvedValue({ success: true });
    const printSocket = vi.fn().mockResolvedValue({ success: true });
    window.electronAPI = { isElectron: true, getPrinters: vi.fn(), printRaw, printSocket };
    try {
      const bytes = buildOrderReceipt(order, 55, {}, 'cp860@17');
      await printViaDesktopSpooler(bytes, 'Cozinha');
      await printViaDesktopSocket(bytes, '127.0.0.1');
      expect(printRaw).toHaveBeenCalledWith('Cozinha', Array.from(bytes));
      expect(printSocket).toHaveBeenCalledWith('127.0.0.1', 9100, Array.from(bytes));
    } finally { delete window.electronAPI; }
  });
});