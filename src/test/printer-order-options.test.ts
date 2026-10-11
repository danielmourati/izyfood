import { describe, expect, it } from 'vitest';
import { getOrderPrintCopies } from '@/hooks/use-printer';
import { getEnablePrinterDevice, setEnablePrinterDevice } from '@/lib/printer';

describe('printer order options', () => {
  it('prints two copies only for new orders when enabled', () => {
    expect(getOrderPrintCopies('new', { duplicate_new_orders: true })).toBe(2);
    expect(getOrderPrintCopies('reprint', { duplicate_new_orders: true })).toBe(1);
  });

  it('keeps one copy when duplicate printing is disabled', () => {
    expect(getOrderPrintCopies('new', { duplicate_new_orders: false })).toBe(1);
    expect(getOrderPrintCopies('new', null)).toBe(1);
  });

  it('keeps printer activation separate for each attendant on this device', () => {
    localStorage.clear();

    setEnablePrinterDevice(true, 'attendant-a', 'atendente');

    expect(getEnablePrinterDevice('attendant-a', 'atendente')).toBe(true);
    expect(getEnablePrinterDevice('attendant-b', 'atendente')).toBe(false);
  });

  it('does not inherit the legacy device setting for a new attendant', () => {
    localStorage.clear();
    setEnablePrinterDevice(true, 'admin-a', 'admin');

    expect(getEnablePrinterDevice('admin-a', 'admin')).toBe(true);
    expect(getEnablePrinterDevice('dc3547ad-db3b-41f6-95b6-9f6db3727fa7', 'atendente')).toBe(false);
  });
});