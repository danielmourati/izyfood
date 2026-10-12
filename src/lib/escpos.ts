/**
 * ESC/POS command encoder for thermal printers (58mm / 80mm).
 * Produces Uint8Array buffers ready to send via Bluetooth or network.
 */

import { wrapReceiptText } from '@/lib/receipt-layout';
import { supabase } from '@/integrations/supabase/client';
import { getOrderAttendantName, getOrderItemCustomizationGroups, formatCustomizationLine, getOrderItemNoteLines } from '@/lib/utils';
import {
  CHAR_ENCODINGS,
  DEFAULT_CHAR_ENCODING,
  ENCODING_TEST_SAMPLE,
  encodingCalibrationCandidates,
  encodeText,
  encodingSetupCommand,
  getCharEncoding,
  type CharEncoding,
} from '@/lib/escpos-encoding';

const ESC = 0x1B;
const GS = 0x1D;

/**
 * Encoding used by `text()` while a receipt is being built. Builders are
 * synchronous and set/restore it via `withEncoding`, so concurrent prints
 * never interleave.
 */
let activeEncoding: CharEncoding = getCharEncoding(DEFAULT_CHAR_ENCODING);

function withEncoding<T>(encodingId: string | null | undefined, fn: (enc: CharEncoding) => T): T {
  const prev = activeEncoding;
  activeEncoding = getCharEncoding(encodingId);
  try {
    return fn(activeEncoding);
  } finally {
    activeEncoding = prev;
  }
}

function text(s: string): Uint8Array {
  return encodeText(s, activeEncoding);
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
/** `FS .` + `ESC t n` for the printer's calibrated character encoding (sent after every `ESC @`). */
export function codepageCommand(encodingId?: string | null): Uint8Array {
  return encodingSetupCommand(encodingId);
}
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
/** Reset printer text mode: normal width/height, no condensed/double flags */
export const CMD_PRINT_MODE_NORMAL = new Uint8Array([ESC, 0x21, 0x00]);
/** Reset character spacing to printer default */
export const CMD_CHAR_SPACING_DEFAULT = new Uint8Array([ESC, 0x20, 0x00]);
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

/** Reserved price zone (right) inside a wrapped row.
 *  55/58mm (32 useful cols): 22 for name + 9 for price.
 *  80mm (40 useful cols): 27 for name + 12 for price. */
export function receiptPriceZone(cols: number): number {
  return cols <= 32 ? 9 : 12;
}

/** Two-column row: left-aligned label, right-aligned value.
 *  If it would exceed cols, delegates to rowWrap so no line exceeds cols. */
function row(label: string, value: string, cols: number): Uint8Array {
  const gap = cols - label.length - value.length;
  if (gap < 1) return rowWrap(label, value, cols);
  return text(label + ' '.repeat(gap) + value + '\n');
}

function rowWrap(label: string, value: string, cols: number): Uint8Array {
  if (label.length + 1 + value.length <= cols) {
    const gap = cols - label.length - value.length;
    return text(label + ' '.repeat(gap) + value + '\n');
  }

  // Detect indent prefix. Complement lines start with "  + " — reapply an
  // indent of the same width on wrapped lines so text stays visually aligned
  // under the first character after the "+".
  let indent = '';
  const complementMatch = label.match(/^(\s*[+\-]\s+)/);
  if (complementMatch) {
    indent = ' '.repeat(complementMatch[1].length);
  } else {
    const wsMatch = label.match(/^(\s+)/);
    if (wsMatch) indent = wsMatch[1];
  }

  // Preserve the "  + " (or whitespace) prefix as the head of the first line;
  // wrapped lines use `indent` (same width, no "+") instead.
  const headMatch = label.match(/^(\s*(?:\+\s+)?)(.*)$/);
  const head = headMatch ? headMatch[1] : '';
  const rest = headMatch ? headMatch[2] : label;
  const words = rest.trim().split(/\s+/).filter(Boolean);

  // Wrap the label within the "name area". When there's no value to place at
  // the right, use the full column width for the label (kitchen ticket lines).
  const price = value.length === 0 ? 0 : Math.max(value.length, receiptPriceZone(cols));
  const nameMax = value.length === 0 ? cols : Math.max(8, cols - price - 1); // 1 char min gap


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
    if (candidate.length <= nameMax) {
      current = candidate;
    } else {
      if (current.trim().length > 0) lines.push(current);
      pushBreakWord(w, indent);
    }
  }
  if (current.trim().length > 0) lines.push(current);

  // Fit value on the last line with at least 1 space of gap; otherwise
  // push the value on a new right-aligned line — never exceeding cols.
  const last = lines.pop() ?? indent;
  if (last.length + 1 + value.length > cols) {
    if (last.trim().length > 0) lines.push(last);
    const gap = Math.max(0, cols - value.length);
    lines.push(' '.repeat(gap) + value);
  } else {
    const gap = cols - last.length - value.length;
    lines.push(last + ' '.repeat(gap) + value);
  }

  return text(lines.join('\n') + '\n');
}

/**
 * Wrap a single text-only receipt line without padding it to the full paper
 * width. Kitchen tickets use this for item/observation lines because some
 * compact Bluetooth printers are sensitive to trailing-space padded lines
 * followed immediately by ESC/POS mode changes.
 */
function textOnlyWrap(label: string, cols: number): Uint8Array {
  const raw = String(label ?? '');
  const prefix = raw.match(/^(\s*(?:[+*\-]\s+)?(?:\d+(?:[.,]\d+)?(?:x|kg)\s+)?)/)?.[0] ?? '';
  return text(wrapReceiptText(raw.slice(prefix.length), cols, prefix, Math.min(prefix.length, Math.floor(cols / 3))).join('\n') + '\n');
}

/** Format text for hardware centered printing (ESC a 1) without adding manual leading spaces */
function center(s: string, cols: number): Uint8Array {
  const clean = String(s || '').trim();
  if (!clean) return new Uint8Array(0);

  const words = clean.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const w of words) {
    const candidate = current ? current + ' ' + w : w;
    if (candidate.length <= cols) {
      current = candidate;
    } else {
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
  return text(lines.join('\n') + '\n');
}

function fmtBRL(v: number): string {
  if (v === undefined || v === null || isNaN(v)) {
    return 'R$ 0,00';
  }
  const isNeg = v < 0;
  const absVal = Math.abs(v);
  const formatted = absVal.toFixed(2).replace('.', ',');
  if (isNeg) {
    return `-R$${formatted}`;
  }
  if (absVal < 10) {
    return `R$ ${formatted}`;
  }
  return `R$${formatted}`;
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

/**
 * Extract note lines for a kitchen receipt item.
 * Prefers structured fields (selectedNotes + otherNotes); falls back to legacy
 * pipe-joined `notes` string for backward compatibility.
 */
export function getItemNoteLines(item: { notes?: string; selectedNotes?: string[]; otherNotes?: string }): string[] {
  return getOrderItemNoteLines(item);
}

interface OrderItem {
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
  openedByName?: string;
  pickupNotes?: string;
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

/** Shared useful width for printed receipts and their on-screen preview. */
export function receiptColumnsForWidth(paperWidth: number): number {
  return paperWidth <= 58 ? 32 : 40;
}

/** Columns physically available while printing kitchen item blocks. */
export function kitchenItemColumns(paperWidth: number, doubleFont: boolean): number {
  const paperColumns = receiptColumnsForWidth(paperWidth);
  return doubleFont ? Math.floor(paperColumns / 2) : paperColumns;
}

/** Kept for backward-compat callers; safe margin is already baked into receiptColumnsForWidth. */
function detailColsForWidth(paperWidth: number): number {
  return receiptColumnsForWidth(paperWidth);
}

function normalTextMode(): Uint8Array {
  return concat(CMD_PRINT_MODE_NORMAL, CMD_DOUBLE_OFF, CMD_FONT_A, CMD_CHAR_SPACING_DEFAULT, CMD_BOLD_OFF);
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
  feedLines?: number;
  /** Per-printer runtime option; not stored in store_settings. */
  doubleFontOrders?: boolean;
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
  feedLines: 4,
  doubleFontOrders: false,
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
          try { localPs = JSON.parse(saved); } catch { }
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
 * Key-Value row for header/metadata lines (NO right-aligned price zone).
 * Formats `Label: Value`. If total length fits in `cols`, prints on 1 line.
 * Otherwise, wraps `Value` cleanly on next line(s) without splitting single words or right-side gaps.
 */
function kvRow(label: string, value: string, cols: number): Uint8Array {
  return text(wrapReceiptText(value.trim(), cols, `${label.trim()} `, 2).join('\n') + '\n');
}

function fmtDateCompact(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    const hrs = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hrs}:${mins}`;
  } catch {
    return String(iso);
  }
}

/**
 * Build a COMANDA (order ticket for kitchen / production).
 */
function buildOrderReceiptImpl(order: OrderData, paperWidth: number, ps: PrintSettings, charEncoding: string): Uint8Array {
  const cols = receiptColumnsForWidth(paperWidth);
  const doubleFontItems = ps.doubleFontOrders === true;
  const itemCols = kitchenItemColumns(paperWidth, doubleFontItems);
  const orderTitle = order.orderType === 'mesa' || !!order.tableNumber
    ? 'CONSUMO'
    : order.orderType === 'delivery'
      ? 'DELIVERY'
      : order.orderType === 'retirada'
        ? 'RETIRADA'
        : 'COZINHA';
  const tableHeading = order.tableNumber
    ? `MESA: ${String(order.tableNumber).padStart(2, '0')}\n`
    : '';
  const parts: Uint8Array[] = [
    CMD_INIT,
    codepageCommand(charEncoding),
  ];

  parts.push(
    CMD_ALIGN_CENTER,
    CMD_BOLD_ON,
    CMD_DOUBLE_ON,
    center(orderTitle, Math.floor(cols / 2)),
    ...(tableHeading ? [center(tableHeading, Math.floor(cols / 2))] : []),
    CMD_DOUBLE_OFF,
    CMD_BOLD_OFF,
    normalTextMode(),
    CMD_ALIGN_LEFT,
    lineOf('-', cols)
  );

  let tipoPedido = 'BALCÃO';
  if (order.orderType === 'delivery') {
    tipoPedido = 'DELIVERY';
  } else if (order.orderType === 'retirada') {
    tipoPedido = 'RETIRADA';
  } else if (order.tableNumber) {
    tipoPedido = `MESA: ${String(order.tableNumber).padStart(2, '0')}`;
  } else if (order.orderType && orderTypeLabels[order.orderType]) {
    tipoPedido = orderTypeLabels[order.orderType].toUpperCase();
  }

  parts.push(CMD_BOLD_ON, kvRow('Tipo:', tipoPedido, cols), CMD_BOLD_OFF);

  // Row 2: Data
  const dateFormatted = fmtDateCompact(order.createdAt);
  if (dateFormatted) {
    parts.push(kvRow('Data:', dateFormatted, cols));
  }

  // Row 3: Cliente
  const customerName = order.customerName || 'Sem Nome';
  parts.push(kvRow('Cliente:', customerName, cols));

  if (order.orderType === 'delivery' && order.customerAddress) {
    parts.push(kvRow('Endereço:', order.customerAddress, cols));
  } else if (order.orderType === 'retirada' && order.customerPhone) {
    parts.push(kvRow('Telefone:', order.customerPhone, cols));
  }

  const operator = getOrderAttendantName(order);
  parts.push(kvRow('Atendente:', operator, cols));

  // Divider
  parts.push(lineOf('-', cols));

  // Items List Header
  parts.push(CMD_BOLD_ON, text('ITENS DO PEDIDO:\n'), CMD_BOLD_OFF);

  let totalItemsCount = 0;
  order.items.forEach((item, itemIndex) => {
    totalItemsCount += item.quantity || 1;
    const qty = item.weight ? `${item.weight.toFixed(3)}kg` : `${item.quantity}x`;
    parts.push(
      CMD_ALIGN_LEFT,
      CMD_BOLD_ON,
      ...(doubleFontItems ? [CMD_DOUBLE_ON] : [CMD_DOUBLE_OFF]),
      textOnlyWrap(`${qty} ${item.name.toUpperCase()}`, itemCols),
      CMD_BOLD_OFF,
    );
    for (const group of getOrderItemCustomizationGroups(item)) {
      parts.push(CMD_BOLD_ON, textOnlyWrap(` ${group.title}`, itemCols), CMD_BOLD_OFF);
      for (const additional of group.items) {
        parts.push(textOnlyWrap(` - ${formatCustomizationLine(additional)}`, itemCols));
      }
    }
    if (itemIndex < order.items.length - 1) {
      parts.push(lineOf('-', itemCols));
    }
    parts.push(CMD_DOUBLE_OFF, normalTextMode());
  });

  const orderNotes = (order.pickupNotes || '').trim();
  if (orderNotes) {
    parts.push(
      lineOf('-', cols),
      CMD_BOLD_ON,
      ...(doubleFontItems ? [CMD_DOUBLE_ON] : [CMD_DOUBLE_OFF]),
      textOnlyWrap('OBS:', itemCols),
    );
    for (const line of orderNotes.split(/\r?\n/)) {
      if (line.trim()) parts.push(textOnlyWrap(line.trim(), itemCols));
    }
    parts.push(CMD_DOUBLE_OFF, CMD_BOLD_OFF, normalTextMode());
  }

  parts.push(lineOf('-', cols));
  const qtdCols = Math.min(cols, 22);
  parts.push(CMD_BOLD_ON, leftRightAlign('QTD. TOTAL ITENS:', `${totalItemsCount}`, qtdCols), CMD_BOLD_OFF);
  parts.push(lineOf('-', cols));

  parts.push(feedAndCut(Math.max(3, ps.feedLines ?? 4)));

  return concat(...parts);
}

/**
 * Build a CONTA (bill / receipt for customer after payment).
 */
function buildBillReceiptImpl(bill: BillData, paperWidth: number, ps: PrintSettings, charEncoding: string): Uint8Array {
  const cols = receiptColumnsForWidth(paperWidth);
  const parts: Uint8Array[] = [
    CMD_INIT,
    codepageCommand(charEncoding),
    normalTextMode(),
  ];

  // Dynamic header — each field evaluated independently.
  const hasStoreName = !!(ps.storeName && ps.storeName.trim());
  const hasAddress = !!(ps.showAddress && ps.address);
  const hasDocument = !!(ps.showDocument && ps.document);
  const hasWhatsapp = !!(ps.showWhatsapp && ps.whatsapp);
  const hasAnyHeader = hasStoreName || hasAddress || hasDocument || hasWhatsapp;

  if (hasAnyHeader) {
    parts.push(CMD_ALIGN_CENTER);
    if (hasStoreName) {
      parts.push(CMD_BOLD_ON, center(ps.storeName!.trim().toUpperCase(), cols), CMD_BOLD_OFF);
    }
    if (hasAddress) {
      parts.push(center(ps.address!, cols));
    }
    if (hasDocument) {
      parts.push(center(`${(ps.documentType || 'CNPJ').toUpperCase()}: ${ps.document}`, cols));
    }
    if (hasWhatsapp) {
      parts.push(center(`WhatsApp: ${ps.whatsapp}`, cols));
    }
    parts.push(CMD_ALIGN_LEFT, lineOf('-', cols));
  }

  // Print "CONTA"
  parts.push(
    CMD_ALIGN_CENTER,
    CMD_BOLD_ON,
    CMD_DOUBLE_ON,
    text('CONTA\n'),
    CMD_DOUBLE_OFF,
    CMD_BOLD_OFF,
    normalTextMode(),
    CMD_ALIGN_LEFT,
    lineOf('-', cols),
    CMD_ALIGN_CENTER, center(cols <= 32 ? 'NÃO É DOCUMENTO FISCAL' : '*** NÃO É DOCUMENTO FISCAL ***', cols),
    CMD_ALIGN_LEFT, lineOf('=', cols)
  );

  // Each detail field as a row(): label left, value right.
  const rawOrderType = bill.orderType?.toLowerCase().trim() || '';
  const orderTypeVal = (orderTypeLabels[rawOrderType] || bill.orderType || 'Mesa').trim();
  const formattedOrderType = orderTypeVal.charAt(0).toUpperCase() + orderTypeVal.slice(1);
  parts.push(CMD_ALIGN_LEFT, kvRow('Tipo:', formattedOrderType, cols));
  if (bill.tableNumber || rawOrderType === 'mesa') {
    parts.push(kvRow('Mesa:', String(bill.tableNumber || 'N/A'), cols));
  }
  parts.push(kvRow('Cliente:', bill.customerName?.trim() || 'Consumidor', cols));
  parts.push(kvRow('Data:', fmtDateCompact(bill.createdAt), cols));
  parts.push(kvRow('Atendente:', getOrderAttendantName(bill), cols));
  parts.push(lineOf('-', cols));

  // Items with price — each item as a rowWrap() so long names break into multiple lines.
  for (const item of bill.items) {
    const qty = item.weight ? `${item.weight.toFixed(3)}kg` : `${item.quantity}x`;
    parts.push(CMD_BOLD_ON, textOnlyWrap(`${qty} ${item.name}`, cols), CMD_BOLD_OFF);
    for (const group of getOrderItemCustomizationGroups(item)) {
      parts.push(CMD_BOLD_ON, textOnlyWrap(`  ${group.title}`, cols), CMD_BOLD_OFF);
      for (const additional of group.items) {
        const additionalValue = additional.price * additional.quantity * (item.weight ? 1 : item.quantity);
        const label = `  - ${formatCustomizationLine(additional)}`;
        parts.push(additionalValue > 0 ? rowWrap(label, fmtBRL(additionalValue), cols) : textOnlyWrap(label, cols));
      }
    }
    const itemTotal = item.subtotal ?? item.price * (item.weight ?? item.quantity);
    const values = `Unit: ${fmtBRL(item.price)}  Total: ${fmtBRL(itemTotal)}`;
    parts.push(CMD_BOLD_ON);
    if (values.length <= cols) parts.push(text(values + '\n'));
    else parts.push(row('Unit:', fmtBRL(item.price), cols), row('Total:', fmtBRL(itemTotal), cols));
    parts.push(CMD_BOLD_OFF, lineOf('-', cols));
  }
  if (bill.items.length === 0) parts.push(lineOf('-', cols));

  // Adjustments
  const itemsTotal = (bill.items || []).reduce((acc: number, item: any) => {
    const itemSubtotal = item.subtotal ?? (item.price * (item.weight ?? item.quantity));
    return acc + (itemSubtotal || 0);
  }, 0);
  const discountVal = bill.discount ? (bill.discountType === 'percentage' ? (itemsTotal * bill.discount) / 100 : bill.discount) : 0;
  // Regra: rótulo "Taxa de Serviço" SEMPRE aparece no cupom da conta, mas
  // apenas o tipo "mesa" carrega o valor configurado da comissão; demais tipos
  // (balcão/delivery/retirada) ficam zerados R$ 0,00 por padrão.
  const isMesa = rawOrderType === 'mesa';
  const serviceFeeVal = isMesa ? (bill.serviceFee || 0) : 0;
  const deliveryFeeVal = bill.deliveryFee || 0;
  const totalBilled = itemsTotal - discountVal + serviceFeeVal + deliveryFeeVal;

  // Sempre há ao menos a linha de Taxa de Serviço, então o bloco de ajustes
  // e seu separador sempre serão impressos.
  if (bill.discount && bill.discount > 0) {
    const discLabel = bill.discountType === 'percentage' ? `Desconto (${bill.discount}%):` : 'Desconto:';
    parts.push(row(discLabel, `-${fmtBRL(discountVal)}`, cols));
  }
  parts.push(row('Taxa de Serviço:', fmtBRL(serviceFeeVal), cols));
  if (deliveryFeeVal > 0) {
    parts.push(row('Taxa de entrega:', fmtBRL(deliveryFeeVal), cols));
  }
  parts.push(lineOf('-', cols));

  // TOTAL Line - left-aligned single line guaranteed never to wrap on 55mm/58mm/80mm
  parts.push(CMD_ALIGN_LEFT, CMD_BOLD_ON);
  const totalValStr = fmtBRL(totalBilled);
  parts.push(text(`TOTAL: ${totalValStr}\n`));
  parts.push(CMD_BOLD_OFF, lineOf('-', cols));

  // Payment
  const hasPayment = (bill.paymentSplits && bill.paymentSplits.length > 0) || !!bill.paymentMethod;
  if (hasPayment) {
    parts.push(CMD_BOLD_ON, text('PAGAMENTO:\n'), CMD_BOLD_OFF);
    if (bill.paymentSplits && bill.paymentSplits.length > 0) {
      for (const s of bill.paymentSplits) {
        const methodLabel = paymentLabels[s.method] || s.method;
        parts.push(row(methodLabel, fmtBRL(s.amount), cols));
      }
    } else if (bill.paymentMethod) {
      const methodLabel = paymentLabels[bill.paymentMethod] || bill.paymentMethod;
      parts.push(row(methodLabel, fmtBRL(totalBilled), cols));
    }
    parts.push(lineOf('-', cols));
  }

  // Footer — each field evaluated independently.
  const footerPixKey = !!(ps.showPixKey && ps.pixKey);
  const footerInstagram = !!(ps.showInstagram && ps.instagram);
  const footerThankMsg = ps.showThankMessage
    ? (ps.thankMessage || 'Obrigado pela preferência!')
    : null;
  const hasFooter = footerPixKey || footerInstagram || !!footerThankMsg;

  if (hasFooter) {
    parts.push(CMD_ALIGN_CENTER);
    if (footerPixKey) parts.push(center(`PIX: ${ps.pixKey}`, cols));
    if (footerInstagram) {
      const cleanInsta = ps.instagram!.startsWith('@') ? ps.instagram! : `@${ps.instagram!}`;
      parts.push(center(`Instagram: ${cleanInsta}`, cols));
    }
    if (footerThankMsg) {
      parts.push(CMD_BOLD_ON, center(footerThankMsg, cols), CMD_BOLD_OFF);
    }
  }

  // Feed configured lines then cut (guarantees guillotine does not cut receipt footer)
  parts.push(feedAndCut(Math.max(3, ps.feedLines ?? 4)));

  return concat(...parts);
}



/**
 * Build FECHAMENTO DE CAIXA receipt.
 */
function buildCashCloseReceiptImpl(data: CashCloseData, paperWidth: number, charEncoding: string): Uint8Array {
  const cols = receiptColumnsForWidth(paperWidth);
  const parts: Uint8Array[] = [
    CMD_INIT,
    codepageCommand(charEncoding),
    CMD_ALIGN_CENTER,
    CMD_BOLD_ON, CMD_DOUBLE_ON,
    center('FECHAMENTO DE CAIXA', Math.floor(cols / 2)),
    CMD_DOUBLE_OFF, CMD_BOLD_OFF, normalTextMode(),
    CMD_ALIGN_LEFT,
    lineOf('=', cols),
    kvRow('Abertura:', fmtDate(data.openedAt), cols),
  ];

  if (data.closedAt) parts.push(kvRow('Fechamento:', fmtDate(data.closedAt), cols));
  parts.push(kvRow('Operador:', data.operatorName, cols));
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

/**
 * Build a COMANDA (order ticket for kitchen / production).
 * `charEncoding` is the printer's calibrated `printer_configs.char_encoding`.
 */
export function buildOrderReceipt(order: OrderData, paperWidth = 80, ps: PrintSettings = {}, charEncoding: string | null = DEFAULT_CHAR_ENCODING): Uint8Array {
  return withEncoding(charEncoding, (enc) => buildOrderReceiptImpl(order, paperWidth, ps, enc.id));
}

/** Build a CONTA (customer bill). */
export function buildBillReceipt(bill: BillData, paperWidth = 80, ps: PrintSettings = {}, charEncoding: string | null = DEFAULT_CHAR_ENCODING): Uint8Array {
  return withEncoding(charEncoding, (enc) => buildBillReceiptImpl(bill, paperWidth, ps, enc.id));
}

/** Build FECHAMENTO DE CAIXA receipt. */
export function buildCashCloseReceipt(data: CashCloseData, paperWidth = 80, charEncoding: string | null = DEFAULT_CHAR_ENCODING): Uint8Array {
  return withEncoding(charEncoding, (enc) => buildCashCloseReceiptImpl(data, paperWidth, enc.id));
}

/**
 * Calibration page: prints the same accented sample once per supported
 * encoding, each preceded by its own `ESC t n`. The operator picks the
 * numbered line that printed correctly.
 */
export function buildEncodingTestReceipt(paperWidth = 80, expandedEncoding?: string): Uint8Array {
  const cols = receiptColumnsForWidth(paperWidth);
  const ascii = (s: string) => encodeText(s, 'ascii');
  const parts: Uint8Array[] = [
    CMD_INIT,
    CMD_ALIGN_CENTER, CMD_BOLD_ON,
    ascii('TESTE DE ACENTUACAO\n'),
    CMD_BOLD_OFF, CMD_ALIGN_LEFT,
    ascii('='.repeat(cols) + '\n'),
    ascii('Escolha o numero da linha que\nsaiu correta e selecione a mesma\nopcao em Acentuacao.\n'),
    ascii('-'.repeat(cols) + '\n'),
  ];
  // A/B comparison: same CP850 sample without and with the multibyte cancel.
  // If only B prints correctly, the printer was in Chinese/Kanji mode.
  const cp850 = getCharEncoding('cp850');
  const abSample = 'Ação Maçã Café Ç Ã É';
  parts.push(CMD_INIT, normalTextMode(), CMD_ALIGN_LEFT, CMD_BOLD_ON, ascii('A) CP850 sem desligar modo chines\n'), CMD_BOLD_OFF,
    cp850.command, encodeText(wrapReceiptText(abSample, cols).join('\n') + '\n', cp850), ascii('\n'));
  parts.push(CMD_INIT, normalTextMode(), CMD_ALIGN_LEFT, CMD_BOLD_ON, ascii('B) CP850 desligando modo chines\n'), CMD_BOLD_OFF,
    encodingSetupCommand(cp850), encodeText(wrapReceiptText(abSample, cols).join('\n') + '\n', cp850), ascii('\n'),
    ascii('-'.repeat(cols) + '\n'));
  // Factory-table options first, right after ESC @ resets the table.
  const ordered = expandedEncoding ? encodingCalibrationCandidates(expandedEncoding) : [
    ...CHAR_ENCODINGS.filter(e => e.command.length === 0),
    ...CHAR_ENCODINGS.filter(e => e.command.length > 0),
  ];
  // Number by position in CHAR_ENCODINGS so it matches the select order.
  for (const enc of ordered) {
    const n = CHAR_ENCODINGS.indexOf(enc) + 1;
    parts.push(CMD_INIT, normalTextMode(), CMD_ALIGN_LEFT);
    const label = expandedEncoding ? enc.testLabel : `${n}) ${enc.testLabel}`;
    parts.push(CMD_BOLD_ON, ascii(wrapReceiptText(label, cols).join('\n') + '\n'), CMD_BOLD_OFF);
    const sample = expandedEncoding ? 'Ação Maçã Café Ç Ã É' : ENCODING_TEST_SAMPLE;
    parts.push(encodingSetupCommand(enc), encodeText(wrapReceiptText(sample, cols).join('\n') + '\n', enc), ascii('\n'));
  }
  parts.push(CMD_INIT, ascii('-'.repeat(cols) + '\n'), feedAndCut());
  return concat(...parts);
}

export function buildEncodingVerificationReceipt(paperWidth: number, encoding: string): Uint8Array {
  const enc = getCharEncoding(encoding);
  const cols = receiptColumnsForWidth(paperWidth);
  return concat(CMD_INIT, normalTextMode(), CMD_ALIGN_LEFT,
    encodeText(wrapReceiptText(`CONFIRMACAO ${enc.testLabel}`, cols).join('\n') + '\n', 'ascii'),
    encodingSetupCommand(enc), encodeText('Ação, Maçã, Café, Ç, Ã, É\n', enc), feedAndCut());
}
