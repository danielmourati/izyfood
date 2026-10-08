import { describe, expect, it } from 'vitest';
import { getOrderPrintCopies } from '@/hooks/use-printer';

describe('printer order options', () => {
  it('prints two copies only for new orders when enabled', () => {
    expect(getOrderPrintCopies('new', { duplicate_new_orders: true })).toBe(2);
    expect(getOrderPrintCopies('reprint', { duplicate_new_orders: true })).toBe(1);
  });

  it('keeps one copy when duplicate printing is disabled', () => {
    expect(getOrderPrintCopies('new', { duplicate_new_orders: false })).toBe(1);
    expect(getOrderPrintCopies('new', null)).toBe(1);
  });
});