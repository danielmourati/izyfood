/**
 * ESC/POS command encoder for thermal printers (58mm / 80mm).
 * Produces Uint8Array buffers ready to send via Bluetooth or network.
 */

import { supabase } from '@/integrations/supabase/client';

const ESC = 0x1B;
const GS = 0x1D;

// ---------- low-level helpers ----------

const encoder = new TextEncoder();

function text(s: string): Uint8Array {
  return encoder.encode(s);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(len);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

// ---------- ESC/POS command builders ----------

/** Initialise printer */
export const CMD_INIT = new Uint8Array([ESC, 0x40]);
/** Select code page (PC860: Portuguese) */
export const CMD_CODEPAGE_PC860 = new Uint8Array([ESC, 0x74, 0x03]);
/** Line feed */
export const CMD_LF = new Uint8Array([0x0A]);
/** Bold on */
export const CMD_BOLD_ON = new Uint8Array([ESC, 0x45, 0x01]);
/** Bold off */
export const CMD_BOLD_OFF = new Uint8Array([ESC, 0x45, 0x00]);
/** Align left */
export const CMD_ALIGN_LEFT = new Uint8Array([ESC, 0x61, 0x00]);
/** Align center */
export const CMD_ALIGN_CENTER = new Uint8Array([ESC, 0x61, 0x01]);
/** Align right */
export const CMD_ALIGN_RIGHT = new Uint8Array([ESC, 0x61, 0x02]);
/** Double height on */
export const CMD_DOUBLE_ON = new Uint8Array([GS, 0x21, 0x11]);
/** Double height off */
export const CMD_DOUBLE_OFF = new Uint8Array([GS, 0x21, 0x00]);
/** Full cut */
export const CMD_CUT = new Uint8Array([GS, 0x56, 0x00]);
/** Partial cut */
export const CMD_PARTIAL_CUT = new Uint8Array([GS, 0x56, 0x01]);
/** Select Font B (smaller, condensed) */
export const CMD_FONT_B = new Uint8Array([ESC, 0x4D, 0x01]);
/** Select Font A (normal) */
export const CMD_FONT_A = new Uint8Array([ESC, 0x4D, 0x00]);
/** Feed n lines then cut */
export function feedAndCut(lines = 4): Uint8Array {
  const feeds = new Uint8Array(lines).fill(0x0A);
  return concat(feeds, CMD_PARTIAL_CUT);
}

// ---------- text formatting helpers ----------

function lineOf(char: string, cols: number): Uint8Array {
  return text(char.repeat(cols) + '\n');
}

/** Two-column row: left-aligned label, right-aligned value */
function row(label: string, value: string, cols: number): Uint8Array {
  const gap = cols - label.length - value.length;
  if (gap < 1) return text(label + ' ' + value + '\n');
  return text(label + ' '.repeat(gap) + value + '\n');
}

function center(s: string, cols: number): Uint8Array {
  const pad = Math.max(0, Math.floor((cols - s.length) / 2));
  return text(' '.repeat(pad) + s + '\n');
}

function fmtBRL(v: number): string {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ---------- receipt builders ----------

/** Helper to align left and right text within given column width */
function leftRightAlign(left: string, right: string, cols: number): Uint8Array {
  const gap = cols - left.length - right.length;
  if (gap < 1) return text(left + ' ' + right + '\n');
  return text(left + ' '.repeat(gap) + right + '\n');
}

interface OrderItem {
  name: string;
  quantity: number;
  weight?: number;
  price: number;
  subtotal: number;
  notes?: string;
  selectedComplements?: { name: string; price: number; quantity: number }[];
}

interface OrderData {
  id: string;
  orderType: string;
  tableNumber?: number;
  items: OrderItem[];
  total: number;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  createdAt: string;
  operatorName?: string;
}

interface BillData extends OrderData {
  paymentMethod?: string;
  paymentSplits?: { method: string; amount: number }[];
  discount?: number;
  discountType?: string;
  serviceFee?: number;
  deliveryFee?: number;
}

interface CashCloseData {
  openedAt: string;
  closedAt?: string;
  operatorName: string;
  initialAmount: number;
  totalCash: number;
  totalPix: number;
  totalCard: number;
  totalFiado: number;
  totalSales: number;
}

function colsForWidth(paperWidth: number): number {
  return paperWidth <= 58 ? 32 : 48;
}

export interface PrintSettings {
  storeName?: string;
  address?: string;
  document?: string;
  documentType?: 'cnpj' | 'cpf';
  whatsapp?: string;
  pixKey?: string;
  instagram?: string;
  thankMessage?: string;
  showAddress?: boolean;
  showDocument?: boolean;
  showWhatsapp?: boolean;
  showPixKey?: boolean;
  showInstagram?: boolean;
  showThankMessage?: boolean;
}

/** Safe defaults: all toggles false, all text empty — no field ever undefined */
const PRINT_SETTINGS_DEFAULTS: Required<PrintSettings> = {
  storeName: '',
  address: '',
  document: '',
  documentType: 'cnpj',
  whatsapp: '',
  pixKey: '',
  instagram: '',
  thankMessage: 'Obrigado pela preferência!',
  showAddress: false,
  showDocument: false,
  showWhatsapp: false,
  showPixKey: false,
  showInstagram: false,
  showThankMessage: false,
};

let _cachedPrintSettings: PrintSettings | null = null;

export async function fetchPrintSettings(tenantId: string): Promise<PrintSettings> {
  try {
    const [settingsRes, tenantRes] = await Promise.all([
      supabase.from('store_settings').select('print_settings').eq('tenant_id', tenantId).limit(1).maybeSingle(),
      supabase.from('tenants').select('name').eq('id', tenantId).limit(1).maybeSingle()
    ]);
    const ps = (settingsRes?.data as any)?.print_settings;
    const name = (tenantRes?.data as any)?.name ?? '';

    let printSettings: PrintSettings;
    if (ps && typeof ps === 'object' && Object.keys(ps).length > 0) {
      printSettings = { ...PRINT_SETTINGS_DEFAULTS, ...ps, storeName: name };
      console.log('[escpos] fetchPrintSettings: source=database');
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`print_settings_${tenantId}`, JSON.stringify(printSettings));
        (window as any).__printSettingsCache = printSettings;
      }
    } else {
      // DB empty — fallback to localStorage as last resort
      let localPs: Partial<PrintSettings> = {};
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem(`print_settings_${tenantId}`);
        if (saved) {
          try { localPs = JSON.parse(saved); } catch {}
          console.log('[escpos] fetchPrintSettings: source=localStorage (DB was empty)');
        } else {
          console.log('[escpos] fetchPrintSettings: source=defaults (both DB and localStorage empty)');
        }
      }
      printSettings = { ...PRINT_SETTINGS_DEFAULTS, ...localPs, storeName: name };
    }
    _cachedPrintSettings = printSettings;
  } catch (e) {
    console.error('[escpos] fetchPrintSettings error:', e);
    if (!_cachedPrintSettings) _cachedPrintSettings = { ...PRINT_SETTINGS_DEFAULTS };
  }
  return _cachedPrintSettings!;
}

export function getCachedPrintSettings(): PrintSettings {
  // Prefer the window cache (set by StoreContext or use-printer)
  if (typeof window !== 'undefined' && (window as any).__printSettingsCache) {
    return (window as any).__printSettingsCache as PrintSettings;
  }
  return _cachedPrintSettings ?? { ...PRINT_SETTINGS_DEFAULTS };
}

const paymentLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao: 'Cartão',
  fiado: 'Fiado',
};

const orderTypeLabels: Record<string, string> = {
  balcao: 'Balcão',
  mesa: 'Mesa',
  delivery: 'Delivery',
  retirada: 'Retirada',
};

/**
 * Build a COMANDA (order ticket for kitchen / production).
 */
export function buildOrderReceipt(order: OrderData, paperWidth = 80, ps: PrintSettings = {}): Uint8Array {
  const cols = colsForWidth(paperWidth);
  const parts: Uint8Array[] = [
    CMD_INIT,
    CMD_CODEPAGE_PC860,
  ];

  // Dynamic header — each field evaluated independently.
  // storeName is ALWAYS printed if non-empty (mandatory branding, no toggle needed).
  const hasStoreName = !!(ps.storeName && ps.storeName.trim());
  const hasAddress   = !!(ps.showAddress && ps.address);
  const hasDocument  = !!(ps.showDocument && ps.document);
  const hasWhatsapp  = !!(ps.showWhatsapp && ps.whatsapp);
  const hasAnyHeader = hasStoreName || hasAddress || hasDocument || hasWhatsapp;

  if (hasAnyHeader) {
    // Use Font A for direct Bluetooth receipts: several mobile thermal printers ignore Font B.
    parts.push(CMD_FONT_A);
    if (hasStoreName) {
      parts.push(CMD_ALIGN_CENTER, CMD_BOLD_ON, text(`${ps.storeName!.trim().toUpperCase()}\n`), CMD_BOLD_OFF);
    }
    if (hasAddress) {
      parts.push(CMD_ALIGN_CENTER, text(`${ps.address}\n`));
    }
    if (hasDocument) {
      parts.push(CMD_ALIGN_CENTER, text(`${(ps.documentType || 'CNPJ').toUpperCase()}: ${ps.document}\n`));
    }
    if (hasWhatsapp) {
      parts.push(CMD_ALIGN_CENTER, text(`WhatsApp: ${ps.whatsapp}\n`));
    }
    parts.push(CMD_ALIGN_LEFT, CMD_FONT_A, lineOf('-', cols));
  }

  parts.push(
    CMD_ALIGN_CENTER,
    text('Cozinha Principal\n\n'),
    CMD_ALIGN_LEFT,
  );

  const orderNo = order.id ? order.id.slice(0, 4).toUpperCase() : '0000';
  parts.push(text(`${fmtDate(order.createdAt)} Pedido No: ${orderNo}\n\n`));

  parts.push(CMD_ALIGN_CENTER);
  parts.push(text(`* Cod. Pers./Senha: ${orderNo} *\n`));
  
  let tipoPedido = 'BALCÃO';
  if (order.orderType === 'delivery') {
    tipoPedido = 'DELIVERY';
  } else if (order.orderType === 'retirada') {
    tipoPedido = 'RETIRADA';
  } else if (order.tableNumber) {
    tipoPedido = `MESA: ${String(order.tableNumber).padStart(3, '0')}`;
  } else if (order.orderType && orderTypeLabels[order.orderType]) {
    tipoPedido = orderTypeLabels[order.orderType].toUpperCase();
  }

  parts.push(CMD_BOLD_ON, text(`${tipoPedido}\n\n`), CMD_BOLD_OFF);

  parts.push(CMD_ALIGN_LEFT);
  
  const customerLine = order.orderType === 'delivery'
    ? `${order.customerName || 'Sem Nome'}${order.customerAddress ? ' - ' + order.customerAddress : ''}`
    : order.orderType === 'retirada'
    ? `${order.customerName || 'Sem Nome'}${order.customerPhone ? ' (' + order.customerPhone + ')' : ''}`
    : (order.customerName || 'Sem Nome');

  parts.push(text(`Cliente: ${customerLine}\n\n`));

  // Items
  for (const item of order.items) {
    const qty = item.weight ? `${item.weight.toFixed(3)}kg` : `${item.quantity}`;
    parts.push(CMD_BOLD_ON, text(`${qty} ${item.name}\n`), CMD_BOLD_OFF);
    if (item.notes) parts.push(text(`  *${item.notes}\n`));
    if (item.selectedComplements && item.selectedComplements.length > 0) {
      for (const comp of item.selectedComplements) {
        parts.push(text(`  + ${comp.quantity}x ${comp.name}\n`));
      }
    }
  }

  parts.push(text('\n'));
  parts.push(text('Atendente do Pedido:\n'));
  parts.push(text(`${order.operatorName || 'Não informado'}\n`));
  
  // Footer — each field evaluated independently.
  // thankMessage fallback so something always prints in the footer if showThankMessage is ON.
  const footerPixKey    = !!(ps.showPixKey && ps.pixKey);
  const footerInstagram = !!(ps.showInstagram && ps.instagram);
  const footerThankMsg  = ps.showThankMessage
    ? (ps.thankMessage || 'Obrigado pela preferência!')
    : null;
  const hasFooter = footerPixKey || footerInstagram || !!footerThankMsg;

  if (hasFooter) {
    parts.push(CMD_FONT_A, lineOf('-', cols), CMD_ALIGN_CENTER);
    if (footerPixKey)    parts.push(text(`PIX: ${ps.pixKey}\n`));
    if (footerInstagram) parts.push(text(`Instagram: ${ps.instagram}\n`));
    if (footerThankMsg) {
      parts.push(CMD_BOLD_ON, text(`${footerThankMsg}\n`), CMD_BOLD_OFF);
    }
    parts.push(CMD_FONT_A, CMD_ALIGN_LEFT);
  }

  parts.push(feedAndCut());

  return concat(...parts);
}

/**
 * Build a CONTA (bill / receipt for customer after payment).
 */
export function buildBillReceipt(bill: BillData, paperWidth = 80, ps: PrintSettings = {}): Uint8Array {
  const cols = colsForWidth(paperWidth);
  const parts: Uint8Array[] = [
    CMD_INIT,
    CMD_CODEPAGE_PC860,
    CMD_ALIGN_CENTER,
  ];

  // Dynamic header — each field evaluated independently.
  // storeName is ALWAYS printed if non-empty (mandatory branding, no toggle needed).
  const hasStoreName = !!(ps.storeName && ps.storeName.trim());
  const hasAddress   = !!(ps.showAddress && ps.address);
  const hasDocument  = !!(ps.showDocument && ps.document);
  const hasWhatsapp  = !!(ps.showWhatsapp && ps.whatsapp);
  const hasAnyHeader = hasStoreName || hasAddress || hasDocument || hasWhatsapp;

  if (hasAnyHeader) {
    parts.push(CMD_FONT_B);
    if (hasStoreName) {
      parts.push(CMD_ALIGN_CENTER, CMD_BOLD_ON, text(`${ps.storeName!.trim().toUpperCase()}\n`), CMD_BOLD_OFF);
    }
    if (hasAddress) {
      parts.push(CMD_ALIGN_CENTER, text(`${ps.address}\n`));
    }
    if (hasDocument) {
      parts.push(CMD_ALIGN_CENTER, text(`${(ps.documentType || 'CNPJ').toUpperCase()}: ${ps.document}\n`));
    }
    if (hasWhatsapp) {
      parts.push(CMD_ALIGN_CENTER, text(`WhatsApp: ${ps.whatsapp}\n`));
    }
    parts.push(CMD_ALIGN_LEFT, CMD_FONT_A, lineOf('-', cols));
  }

  // Print "CONTA"
  parts.push(
    CMD_ALIGN_CENTER,
    CMD_BOLD_ON, CMD_DOUBLE_ON,
    text('CONTA\n'),
    CMD_DOUBLE_OFF, CMD_BOLD_OFF,
    CMD_ALIGN_LEFT,
    lineOf('=', cols),
  );

  parts.push(leftRightAlign('Tipo:', orderTypeLabels[bill.orderType] || bill.orderType, cols));
  if (bill.tableNumber || bill.orderType === 'mesa') {
    parts.push(leftRightAlign('Mesa:', String(bill.tableNumber || 'N/A'), cols));
  }
  parts.push(leftRightAlign('Cliente:', bill.customerName || '', cols));
  parts.push(leftRightAlign('Data:', fmtDate(bill.createdAt), cols));
  parts.push(lineOf('-', cols));

  // Items with price
  for (const item of bill.items) {
    const qty = item.weight ? `${item.weight.toFixed(3)}kg` : `${item.quantity}x`;
    parts.push(leftRightAlign(`${qty} ${item.name}`, fmtBRL(item.subtotal), cols));
    if (item.selectedComplements && item.selectedComplements.length > 0) {
      for (const comp of item.selectedComplements) {
        parts.push(leftRightAlign(`  + ${comp.quantity}x ${comp.name}`, fmtBRL(comp.price * comp.quantity * (item.weight ? 1 : item.quantity)), cols));
      }
    }
  }

  parts.push(lineOf('-', cols));

  // Always recompute totals from items + adjustments so service fee/discount/delivery are included
  const itemsTotal = (bill.items || []).reduce((acc: number, item: any) => {
    const itemSubtotal = item.subtotal ?? (item.price * (item.weight ?? item.quantity));
    return acc + (itemSubtotal || 0);
  }, 0);
  const discountVal = bill.discount ? (bill.discountType === 'percentage' ? (itemsTotal * bill.discount) / 100 : bill.discount) : 0;
  const serviceFeeVal = bill.serviceFee || 0;
  const deliveryFeeVal = bill.deliveryFee || 0;
  const totalBilled = itemsTotal - discountVal + serviceFeeVal + deliveryFeeVal;

  if (bill.discount && bill.discount > 0) {
    const discLabel = bill.discountType === 'percentage' ? `Desconto (${bill.discount}%)` : 'Desconto';
    parts.push(row(discLabel, `-${fmtBRL(bill.discountType === 'percentage' ? totalBilled * bill.discount / 100 : bill.discount)}`, cols));
  }
  if (bill.serviceFee && bill.serviceFee > 0) {
    parts.push(row('Taxa de serviço', fmtBRL(bill.serviceFee), cols));
  }
  if (bill.deliveryFee && bill.deliveryFee > 0) {
    parts.push(row('Taxa de entrega', fmtBRL(bill.deliveryFee), cols));
  }

  parts.push(lineOf('=', cols));
  parts.push(CMD_BOLD_ON, CMD_DOUBLE_ON);
  const doubleCols = Math.floor(cols / 2);
  parts.push(leftRightAlign('TOTAL', fmtBRL(totalBilled), doubleCols));
  parts.push(CMD_DOUBLE_OFF, CMD_BOLD_OFF);

  // Payment
  if (bill.paymentSplits && bill.paymentSplits.length > 0) {
    parts.push(lineOf('-', cols));
    parts.push(CMD_BOLD_ON, text('PAGAMENTO:\n'), CMD_BOLD_OFF);
    for (const s of bill.paymentSplits) {
      parts.push(row(paymentLabels[s.method] || s.method, fmtBRL(s.amount), cols));
    }
  } else if (bill.paymentMethod) {
    parts.push(row('Pgto:', paymentLabels[bill.paymentMethod] || bill.paymentMethod, cols));
  }

  // Footer separator — Font B (smaller)
  parts.push(CMD_FONT_B, lineOf('-', cols), CMD_FONT_A);

  // Footer — each field evaluated independently.
  // thankMessage uses a fallback so there's always a closing message if the toggle is ON.
  const footerPixKey    = !!(ps.showPixKey && ps.pixKey);
  const footerInstagram = !!(ps.showInstagram && ps.instagram);
  const footerThankMsg  = ps.showThankMessage
    ? (ps.thankMessage || 'Obrigado pela preferência!')
    : null;
  const hasFooter = footerPixKey || footerInstagram || !!footerThankMsg;

  if (hasFooter) {
    parts.push(CMD_ALIGN_CENTER, CMD_FONT_B);
    if (footerPixKey)    parts.push(text(`PIX: ${ps.pixKey}\n`));
    if (footerInstagram) parts.push(text(`Instagram: ${ps.instagram}\n`));
    if (footerThankMsg) {
      parts.push(CMD_BOLD_ON, text(`${footerThankMsg}\n`), CMD_BOLD_OFF);
    }
    parts.push(CMD_FONT_A, CMD_ALIGN_LEFT);
  }

  // Minimal feed then cut (2 lines instead of 4 to save paper)
  parts.push(new Uint8Array([0x0A, 0x0A]), CMD_PARTIAL_CUT);

  return concat(...parts);
}

/**
 * Build FECHAMENTO DE CAIXA receipt.
 */
export function buildCashCloseReceipt(data: CashCloseData, paperWidth = 80): Uint8Array {
  const cols = colsForWidth(paperWidth);
  const parts: Uint8Array[] = [
    CMD_INIT,
    CMD_CODEPAGE_PC860,
    CMD_ALIGN_CENTER,
    CMD_BOLD_ON, CMD_DOUBLE_ON,
    text('FECHAMENTO DE CAIXA\n'),
    CMD_DOUBLE_OFF, CMD_BOLD_OFF,
    CMD_ALIGN_LEFT,
    lineOf('=', cols),
    row('Abertura:', fmtDate(data.openedAt), cols),
  ];

  if (data.closedAt) parts.push(row('Fechamento:', fmtDate(data.closedAt), cols));
  parts.push(row('Operador:', data.operatorName, cols));
  parts.push(lineOf('-', cols));

  parts.push(CMD_BOLD_ON, row('Fundo de Troco:', fmtBRL(data.initialAmount), cols), CMD_BOLD_OFF);
  parts.push(lineOf('-', cols));

  parts.push(CMD_BOLD_ON, text('VENDAS POR FORMA PGTO:\n'), CMD_BOLD_OFF);
  parts.push(row('Dinheiro:', fmtBRL(data.totalCash), cols));
  parts.push(row('PIX:', fmtBRL(data.totalPix), cols));
  parts.push(row('Cartão:', fmtBRL(data.totalCard), cols));
  parts.push(row('Fiado:', fmtBRL(data.totalFiado), cols));

  parts.push(lineOf('-', cols));
  parts.push(CMD_BOLD_ON);
  parts.push(row('TOTAL', fmtBRL(data.totalSales), cols));
  parts.push(CMD_BOLD_OFF);

  parts.push(lineOf('-', cols));
  const saldo = data.initialAmount + data.totalCash;
  parts.push(CMD_BOLD_ON);
  parts.push(row('SALDO CAIXA', fmtBRL(saldo), cols));
  parts.push(CMD_BOLD_OFF);
  parts.push(text('(Fundo + Dinheiro)\n'));

  parts.push(lineOf('=', cols));
  parts.push(feedAndCut());

  return concat(...parts);
}
