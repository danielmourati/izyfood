/**
 * Text-only mirror of buildBillReceipt from escpos.ts.
 * Produces a monospace string preview identical to what will be printed,
 * respecting column width, line wrapping and alignment rules.
 */

import type { PrintSettings } from './escpos';

export interface PreviewItem {
  name: string;
  quantity: number;
  weight?: number;
  price: number;
  subtotal: number;
  selectedComplements?: { name: string; price: number; quantity: number }[];
}

export interface PreviewBill {
  id: string;
  orderType: string;
  tableNumber?: number;
  items: PreviewItem[];
  customerName?: string;
  createdAt: string;
  paymentMethod?: string;
  paymentSplits?: { method: string; amount: number }[];
  discount?: number;
  discountType?: 'percentage' | 'value';
  serviceFee?: number;
  deliveryFee?: number;
}

const paymentLabels: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'PIX', cartao: 'Cartão', fiado: 'Fiado',
};
const orderTypeLabels: Record<string, string> = {
  balcao: 'Balcão', mesa: 'Mesa', delivery: 'Delivery', retirada: 'Retirada',
};

function colsForWidth(paperWidth: number): number {
  // Safe useful width: 58mm=30 (32-margin), 80mm=44 (48-margin)
  return paperWidth <= 58 ? 30 : 44;
}

function priceZone(cols: number): number {
  return cols <= 30 ? 8 : 12;
}

function fmtBRL(v: number): string {
  if (v === undefined || v === null || isNaN(v)) return 'R$ 0,00';
  const isNeg = v < 0;
  const absVal = Math.abs(v);
  const formatted = absVal.toFixed(2).replace('.', ',');
  if (isNeg) return `-R$${formatted}`;
  if (absVal < 10) return `R$ ${formatted}`;
  return `R$${formatted}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function lineOf(char: string, cols: number): string {
  return char.repeat(cols);
}

function centerLine(s: string, cols: number): string {
  const pad = Math.max(0, Math.floor((cols - s.length) / 2));
  return ' '.repeat(pad) + s;
}

function center(s: string, cols: number): string {
  if (s.length <= cols) return centerLine(s, cols);
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const candidate = current ? current + ' ' + w : w;
    if (candidate.length <= cols) current = candidate;
    else {
      if (current) lines.push(current);
      let piece = w;
      while (piece.length > cols) {
        lines.push(piece.slice(0, cols));
        piece = piece.slice(cols);
      }
      current = piece;
    }
  }
  if (current) lines.push(current);
  return lines.map(l => centerLine(l, cols)).join('\n');
}

function row(label: string, value: string, cols: number): string {
  const gap = cols - label.length - value.length;
  if (gap < 1) return rowWrap(label, value, cols);
  return label + ' '.repeat(gap) + value;
}

function rowWrap(label: string, value: string, cols: number): string {
  if (label.length + 1 + value.length <= cols) {
    const gap = cols - label.length - value.length;
    return label + ' '.repeat(gap) + value;
  }

  let indent = '';
  const complementMatch = label.match(/^(\s*\+\s+)/);
  if (complementMatch) {
    indent = ' '.repeat(complementMatch[1].length);
  } else {
    const wsMatch = label.match(/^(\s+)/);
    if (wsMatch) indent = wsMatch[1];
  }

  const headMatch = label.match(/^(\s*(?:\+\s+)?)(.*)$/);
  const head = headMatch ? headMatch[1] : '';
  const rest = headMatch ? headMatch[2] : label;
  const words = rest.trim().split(/\s+/).filter(Boolean);

  const price = Math.max(value.length, priceZone(cols));
  const nameMax = Math.max(8, cols - price - 1);

  const lines: string[] = [];
  let current = head;

  const pushBreakWord = (w: string, prefix: string) => {
    let piece = prefix + w;
    while (piece.length > nameMax) {
      lines.push(piece.slice(0, nameMax));
      piece = indent + piece.slice(nameMax);
    }
    current = piece;
  };

  for (const w of words) {
    const atStart = current === head || current === indent || current === '';
    const candidate = atStart ? current + w : current + ' ' + w;
    if (candidate.length <= nameMax) current = candidate;
    else {
      if (current.trim().length > 0) lines.push(current);
      pushBreakWord(w, indent);
    }
  }
  if (current.trim().length > 0) lines.push(current);

  const last = lines.pop() ?? indent;
  if (last.length + 1 + value.length > cols) {
    if (last.trim().length > 0) lines.push(last);
    const gap = Math.max(0, cols - value.length);
    lines.push(' '.repeat(gap) + value);
  } else {
    const gap = cols - last.length - value.length;
    lines.push(last + ' '.repeat(gap) + value);
  }

  return lines.join('\n');
}

export function buildBillPreviewText(
  bill: PreviewBill,
  paperWidth: 58 | 80,
  ps: PrintSettings = {},
): string {
  const cols = colsForWidth(paperWidth);
  const lines: string[] = [];

  // Header
  const hasStoreName = !!(ps.storeName && ps.storeName.trim());
  const hasAddress = !!(ps.showAddress && ps.address);
  const hasDocument = !!(ps.showDocument && ps.document);
  const hasWhatsapp = !!(ps.showWhatsapp && ps.whatsapp);
  const hasAnyHeader = hasStoreName || hasAddress || hasDocument || hasWhatsapp;

  if (hasAnyHeader) {
    if (hasStoreName) lines.push(center(ps.storeName!.trim().toUpperCase(), cols));
    if (hasAddress) lines.push(center(ps.address!, cols));
    if (hasDocument) lines.push(center(`${(ps.documentType || 'CNPJ').toUpperCase()}: ${ps.document}`, cols));
    if (hasWhatsapp) lines.push(center(`WhatsApp: ${ps.whatsapp}`, cols));
    lines.push(lineOf('-', cols));
  }

  lines.push(center('CONTA', cols));
  lines.push(lineOf('-', cols));
  lines.push('');

  const rawOrderType = bill.orderType?.toLowerCase().trim() || '';
  const orderTypeVal = (orderTypeLabels[rawOrderType] || bill.orderType || 'Mesa').trim();
  const formattedOrderType = orderTypeVal.charAt(0).toUpperCase() + orderTypeVal.slice(1);
  lines.push(row('Tipo:', formattedOrderType, cols));
  if (bill.tableNumber || rawOrderType === 'mesa') {
    lines.push(row('Mesa:', String(bill.tableNumber || 'N/A'), cols));
  }
  lines.push(row('Cliente:', bill.customerName?.trim() || 'Consumidor', cols));
  lines.push(row('Data:', fmtDate(bill.createdAt), cols));
  lines.push(lineOf('-', cols));

  for (const item of bill.items) {
    const qty = item.weight ? `${item.weight.toFixed(3)}kg` : `${item.quantity}x`;
    lines.push(rowWrap(`${qty} ${item.name}`, fmtBRL(item.subtotal), cols));
    if (item.selectedComplements) {
      for (const c of item.selectedComplements) {
        const compQty = `${c.quantity}x`;
        const compPrice = fmtBRL(c.price * c.quantity * (item.weight ? 1 : item.quantity));
        lines.push(rowWrap(`  + ${compQty} ${c.name}`, compPrice, cols));
      }
    }
  }
  lines.push(lineOf('-', cols));

  const itemsTotal = bill.items.reduce(
    (a, i) => a + (i.subtotal ?? i.price * (i.weight ?? i.quantity)), 0,
  );
  const discountVal = bill.discount
    ? (bill.discountType === 'percentage' ? (itemsTotal * bill.discount) / 100 : bill.discount)
    : 0;
  const isMesa = rawOrderType === 'mesa';
  const serviceFeeVal = isMesa ? (bill.serviceFee || 0) : 0;
  const deliveryFeeVal = bill.deliveryFee || 0;
  const totalBilled = itemsTotal - discountVal + serviceFeeVal + deliveryFeeVal;

  if (bill.discount && bill.discount > 0) {
    const discLabel = bill.discountType === 'percentage' ? `Desconto (${bill.discount}%):` : 'Desconto:';
    lines.push(row(discLabel, `-${fmtBRL(discountVal)}`, cols));
  }
  lines.push(row('Taxa de Serviço:', fmtBRL(serviceFeeVal), cols));
  if (deliveryFeeVal > 0) lines.push(row('Taxa de entrega:', fmtBRL(deliveryFeeVal), cols));
  lines.push(lineOf('-', cols));

  lines.push(row('TOTAL', fmtBRL(totalBilled), cols));
  lines.push(lineOf('-', cols));

  const hasPayment = (bill.paymentSplits && bill.paymentSplits.length > 0) || !!bill.paymentMethod;
  if (hasPayment) {
    lines.push('PAGAMENTO:');
    if (bill.paymentSplits && bill.paymentSplits.length > 0) {
      for (const s of bill.paymentSplits) {
        lines.push(row(paymentLabels[s.method] || s.method, fmtBRL(s.amount), cols));
      }
    } else if (bill.paymentMethod) {
      lines.push(row(paymentLabels[bill.paymentMethod] || bill.paymentMethod, fmtBRL(totalBilled), cols));
    }
    lines.push(lineOf('-', cols));
  }

  const footerPixKey = !!(ps.showPixKey && ps.pixKey);
  const footerInstagram = !!(ps.showInstagram && ps.instagram);
  const footerThankMsg = ps.showThankMessage ? (ps.thankMessage || 'Obrigado pela preferência!') : null;

  if (footerPixKey || footerInstagram || footerThankMsg) {
    if (footerPixKey) lines.push(center(`PIX: ${ps.pixKey}`, cols));
    if (footerInstagram) {
      const insta = ps.instagram!.startsWith('@') ? ps.instagram! : `@${ps.instagram!}`;
      lines.push(center(`Instagram: ${insta}`, cols));
    }
    if (footerThankMsg) lines.push(center(footerThankMsg, cols));
  }

  return lines.join('\n');
}
