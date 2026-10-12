/**
 * Text-only mirror of buildBillReceipt from escpos.ts.
 * Produces a monospace string preview identical to what will be printed,
 * respecting column width, line wrapping and alignment rules.
 */

import { buildBillReceipt, receiptColumnsForWidth, type PrintSettings } from './escpos';
import { receiptPlainText } from './receipt-renderer';

export interface PreviewItem {
  name: string;
  addedByName?: string;
  quantity: number;
  weight?: number;
  price: number;
  subtotal: number;
  notes?: string;
  selectedNotes?: string[];
  otherNotes?: string;
  selectedComplements?: { name: string; price: number; quantity: number }[];
}

export interface PreviewBill {
  id: string;
  orderType: string;
  tableNumber?: number;
  items: PreviewItem[];
  customerName?: string;
  openedByName?: string;
  createdAt: string;
  paymentMethod?: string;
  paymentSplits?: { method: string; amount: number }[];
  discount?: number;
  discountType?: 'percentage' | 'value';
  serviceFee?: number;
  deliveryFee?: number;
}

/** The text preview consumes the same builder as physical and browser printing. */
export function buildBillPreviewText(bill: PreviewBill, paperWidth: number, ps: PrintSettings = {}): string {
  const order = { ...bill, total: 0 };
  return receiptPlainText(buildBillReceipt(order, paperWidth, ps, 'utf8'), receiptColumnsForWidth(paperWidth));
}
