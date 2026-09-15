/**
 * ESC/POS command encoder for thermal printers (58mm / 80mm).
 * Produces Uint8Array buffers ready to send via Bluetooth or network.
 */

import { supabase } from '@/integrations/supabase/client';

const ESC = 0x1B;
const GS = 0x1D;

/**
 * Code Page 860 (PC860 Portuguese) mapping dictionary.
 * Maps ABNT PT-BR accented characters and symbols (ç, ã, é, ô, Á, Ç, etc.) to CP860 byte values.
 */
const CP860_MAP: Record<string, number> = {
  'Ç': 0x80, 'ü': 0x81, 'é': 0x82, 'â': 0x83, 'ã': 0x84, 'à': 0x85, 'Á': 0x86, 'ç': 0x87,
  'ê': 0x88, 'Ê': 0x89, 'è': 0x8A, 'Í': 0x8B, 'Ô': 0x8C, 'ì': 0x8D, 'Ã': 0x8E, 'Â': 0x8F,
  'É': 0x90, 'À': 0x91, 'È': 0x92, 'ô': 0x93, 'õ': 0x94, 'ò': 0x95, 'Ú': 0x96, 'ù': 0x97,
  'Ì': 0x98, 'Õ': 0x99, 'Ü': 0x9A, 'á': 0xA0, 'í': 0xA1, 'ó': 0xA2, 'ú': 0xA3, 'ñ': 0xA4,
  'Ñ': 0xA5, 'ª': 0xA6, 'º': 0xA7, '¿': 0xA8, '®': 0xA9, '¬': 0xAA, '½': 0xAB, '¼': 0xAC,
  '¡': 0xAD, '«': 0xAE, '»': 0xAF,
};

/**
 * Encode string to Code Page 860 (PC860 Portuguese) bytes for thermal printing.
 * Guarantees that ABNT PT-BR accents and (ç) print perfectly without corrupting bytes.
 */
export function encodeCp860(s: string): Uint8Array {
  if (!s) return new Uint8Array(0);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const code = ch.charCodeAt(0);
    if (code <= 0x7F) {
      out[i] = code;
    } else if (CP860_MAP[ch] !== undefined) {
      out[i] = CP860_MAP[ch];
    } else {
      const norm = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      out[i] = norm.length > 0 ? norm.charCodeAt(0) : 0x3F;
    }
  }
  return out;
}

function text(s: string): Uint8Array {
  return encodeCp860(s);
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
 *  58mm (32 useful cols): 22 for name + 9 for price.
 *  80mm (48 useful cols): 36 for name + 12 for price. */
function priceZone(cols: number): number {
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
  const complementMatch = label.match(/^(\s*\+\s+)/);
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
  const price = value.length === 0 ? 0 : Math.max(value.length, priceZone(cols));
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
  if (raw.length <= cols) return text(raw + '\n');

  let indent = '';
  const symbolMatch = raw.match(/^(\s*[+*]\s+)/);
  if (symbolMatch) {
    indent = ' '.repeat(symbolMatch[1].length);
  } else {
    const wsMatch = raw.match(/^(\s+)/);
    if (wsMatch) indent = wsMatch[1];
  }

  const headMatch = raw.match(/^(\s*(?:[+*]\s+)?)(.*)$/);
  const head = headMatch ? headMatch[1] : '';
  const rest = headMatch ? headMatch[2] : raw;
  const words = rest.trim().split(/\s+/).filter(Boolean);

  const lines: string[] = [];
  let current = head;

  const pushBreakWord = (word: string, prefix: string) => {
    let piece = prefix + word;
    while (piece.length > cols) {
      lines.push(piece.slice(0, cols));
      piece = indent + piece.slice(cols);
    }
    current = piece;
  };

  for (const word of words) {
    const atStart = current === head || current === indent || current === '';
    const candidate = atStart ? current + word : current + ' ' + word;
    if (candidate.length <= cols) {
      current = candidate;
    } else {
      if (current.trim().length > 0) lines.push(current);
      pushBreakWord(word, indent);
    }
  }

  if (current.trim().length > 0) lines.push(current);
  return text(lines.join('\n') + '\n');
}

function center(s: string, cols: number): Uint8Array {
  if (s.length <= cols) {
    const pad = Math.max(0, Math.floor((cols - s.length) / 2));
    return text(' '.repeat(pad) + s + '\n');
  }
  return centerWrap(s, cols);
}

/** Center a string with word-wrap so no line exceeds `cols`. */
function centerWrap(s: string, cols: number): Uint8Array {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const candidate = current ? current + ' ' + w : w;
    if (candidate.length <= cols) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      // Word alone too long — hard-split
      let piece = w;
      while (piece.length > cols) {
        lines.push(piece.slice(0, cols));
        piece = piece.slice(cols);
      }
      current = piece;
    }
  }
  if (current) lines.push(current);
  return text(
    lines
      .map(l => ' '.repeat(Math.max(0, Math.floor((cols - l.length) / 2))) + l)
      .join('\n') + '\n',
  );
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
  const collected: string[] = [];
  (item.selectedNotes || []).forEach(n => { const t = String(n ?? '').trim(); if (t) collected.push(t); });
  if (item.otherNotes && String(item.otherNotes).trim()) collected.push(String(item.otherNotes).trim());

  // Fallback to legacy pipe-joined `notes` ONLY when no structured line was produced.
  if (collected.length === 0 && item.notes) {
    String(item.notes).split('|').forEach(s => { const t = s.trim(); if (t) collected.push(t); });
  }

  // Case-insensitive dedupe preserving first occurrence.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of collected) {
    const key = l.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out;
}

interface OrderItem {
  name: string;
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

/** Useful column width for the given paper size.
 *  58mm: 30 columns (fits budget 58mm POS thermal printers with 30 printable character limits).
 *  80mm: 44 columns (standard 80mm POS thermal printers). */
function colsForWidth(paperWidth: number): number {
  return paperWidth <= 58 ? 30 : 44;
}

/** Kept for backward-compat callers; safe margin is already baked into colsForWidth. */
function detailColsForWidth(paperWidth: number): number {
  return colsForWidth(paperWidth);
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
  const cleanLabel = label.trim();
  const cleanVal = value.trim();
  if (!cleanVal) return text(cleanLabel + '\n');

  const full = `${cleanLabel} ${cleanVal}`;
  if (full.length <= cols) {
    return text(full + '\n');
  }

  const lines: string[] = [];
  const words = cleanVal.split(/\s+/).filter(Boolean);

  if (cleanLabel.length + 1 + (words[0]?.length || 0) <= cols) {
    let current = cleanLabel + ' ';
    for (const w of words) {
      if ((current + (current.endsWith(' ') ? '' : ' ') + w).length <= cols) {
        current += (current.endsWith(' ') ? '' : ' ') + w;
      } else {
        lines.push(current);
        current = '  ' + w;
      }
    }
    if (current.trim()) lines.push(current);
  } else {
    lines.push(cleanLabel);
    let current = '  ';
    for (const w of words) {
      if ((current + (current === '  ' ? '' : ' ') + w).length <= cols) {
        current += (current === '  ' ? '' : ' ') + w;
      } else {
        lines.push(current);
        current = '  ' + w;
      }
    }
    if (current.trim()) lines.push(current);
  }
  return text(lines.join('\n') + '\n');
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
export function buildOrderReceipt(order: OrderData, paperWidth = 80, ps: PrintSettings = {}): Uint8Array {
  const cols = colsForWidth(paperWidth);
  const parts: Uint8Array[] = [
    CMD_INIT,
    CMD_CODEPAGE_PC860,
  ];

  // Header Title: Bold & Double Height "COZINHA"
  parts.push(
    CMD_ALIGN_CENTER,
    CMD_BOLD_ON,
    CMD_DOUBLE_ON,
    text('*** COZINHA ***\n'),
    CMD_DOUBLE_OFF,
    CMD_BOLD_OFF,
    normalTextMode(),
    CMD_ALIGN_LEFT,
    lineOf('-', cols)
  );

  const orderNo = order.id ? order.id.slice(0, 6).toUpperCase() : '0000';

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

  // Row 1: PEDIDO #38CC            MESA: 01
  const pedLabel = `PEDIDO: #${orderNo}`;
  parts.push(CMD_BOLD_ON, leftRightAlign(pedLabel, tipoPedido, cols), CMD_BOLD_OFF);

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

  const operator = order.operatorName || 'Nao informado';
  parts.push(kvRow('Atendente:', operator, cols));

  // Divider
  parts.push(lineOf('-', cols));

  // Items List Header
  parts.push(CMD_BOLD_ON, text('ITENS DO PEDIDO:\n'), CMD_BOLD_OFF);

  let totalItemsCount = 0;
  for (const item of order.items) {
    totalItemsCount += item.quantity || 1;
    const qty = item.weight ? `${item.weight.toFixed(3)}kg` : `${item.quantity}x`;
    parts.push(
      CMD_ALIGN_LEFT,
      CMD_BOLD_ON,
      textOnlyWrap(`${qty} ${item.name.toUpperCase()}`, cols),
      CMD_BOLD_OFF,
      normalTextMode()
    );
    const noteLines = getItemNoteLines(item);
    for (const n of noteLines) {
      parts.push(CMD_BOLD_ON, textOnlyWrap(`   * OBS: ${n.toUpperCase()}`, cols), CMD_BOLD_OFF);
    }
    if (item.selectedComplements && item.selectedComplements.length > 0) {
      for (const comp of item.selectedComplements) {
        parts.push(textOnlyWrap(`   + ${comp.quantity}x ${comp.name}`, cols));
      }
    }
  }

  parts.push(lineOf('-', cols));
  parts.push(CMD_BOLD_ON, leftRightAlign('QTD. TOTAL ITENS:', `${totalItemsCount}`, cols), CMD_BOLD_OFF);
  parts.push(lineOf('-', cols));

  parts.push(feedAndCut(Math.max(3, ps.feedLines ?? 4)));

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
    normalTextMode(),
    CMD_ALIGN_CENTER,
  ];

  // Dynamic header — each field evaluated independently.
  const hasStoreName = !!(ps.storeName && ps.storeName.trim());
  const hasAddress = !!(ps.showAddress && ps.address);
  const hasDocument = !!(ps.showDocument && ps.document);
  const hasWhatsapp = !!(ps.showWhatsapp && ps.whatsapp);
  const hasAnyHeader = hasStoreName || hasAddress || hasDocument || hasWhatsapp;

  if (hasAnyHeader) {
    parts.push(CMD_ALIGN_LEFT);
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
    parts.push(lineOf('-', cols));
  }

  // Print "CONTA"
  parts.push(
    CMD_ALIGN_CENTER,
    CMD_BOLD_ON,
    CMD_DOUBLE_ON,
    text('CONTA\n'),
    CMD_DOUBLE_OFF,
    CMD_BOLD_OFF,
  );

  // Separador abaixo do título CONTA em fonte normal
  parts.push(
    normalTextMode(),
    CMD_ALIGN_LEFT,
    lineOf('-', cols),
    CMD_LF
  );

  // Garante que o próximo bloco volte para fonte normal e alinhamento à esquerda
  parts.push(
    normalTextMode(),
    CMD_ALIGN_LEFT
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
  parts.push(lineOf('-', cols));

  // Items with price — each item as a rowWrap() so long names break into multiple lines.
  for (const item of bill.items) {
    const qty = item.weight ? `${item.weight.toFixed(3)}kg` : `${item.quantity}x`;
    parts.push(rowWrap(`${qty} ${item.name}`, fmtBRL(item.subtotal), cols));
    if (item.selectedComplements && item.selectedComplements.length > 0) {
      for (const comp of item.selectedComplements) {
        const compQty = `${comp.quantity}x`;
        const compPrice = fmtBRL(comp.price * comp.quantity * (item.weight ? 1 : item.quantity));
        parts.push(rowWrap(`  + ${compQty} ${comp.name}`, compPrice, cols));
      }
    }
  }
  parts.push(lineOf('-', cols));

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

  // TOTAL
  parts.push(CMD_BOLD_ON, CMD_DOUBLE_ON);
  const doubleCols = Math.floor(cols / 2);
  parts.push(row('TOTAL', fmtBRL(totalBilled), doubleCols));
  parts.push(CMD_DOUBLE_OFF, CMD_BOLD_OFF);
  parts.push(normalTextMode(), CMD_ALIGN_LEFT, lineOf('-', cols));

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
    parts.push(CMD_ALIGN_LEFT);
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
