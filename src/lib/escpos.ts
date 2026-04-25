/**
 * ESC/POS command encoder for thermal printers (58mm / 80mm).
 * Produces Uint8Array buffers ready to send via Bluetooth or network.
 */

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
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ---------- receipt builders ----------

interface OrderItem {
  name: string;
  quantity: number;
  weight?: number;
  price: number;
  subtotal: number;
  notes?: string;
}

interface OrderData {
  id: string;
  orderType: string;
  tableNumber?: number;
  items: OrderItem[];
  total: number;
  customerName?: string;
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
  return paperWidth === 58 ? 32 : 48;
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
export function buildOrderReceipt(order: OrderData, paperWidth = 80): Uint8Array {
  const cols = colsForWidth(paperWidth);
  const parts: Uint8Array[] = [
    CMD_INIT,
    CMD_CODEPAGE_PC860,
    CMD_ALIGN_CENTER,
    text('Cozinha Principal\n\n'),
    CMD_ALIGN_LEFT,
  ];

  const orderNo = order.id ? order.id.slice(0, 4).toUpperCase() : '0000';
  parts.push(text(`${fmtDate(order.createdAt)} Pedido No: ${orderNo}\n\n`));

  parts.push(CMD_ALIGN_CENTER);
  parts.push(text(`* Cod. Pers./Senha: ${orderNo} *\n`));
  const comanda = order.tableNumber ? String(order.tableNumber).padStart(3, '0') : 'BALCÃO';
  parts.push(CMD_BOLD_ON, text(`COMANDA: ${comanda}\n\n`), CMD_BOLD_OFF);

  parts.push(CMD_ALIGN_LEFT);
  if (order.customerName) {
    parts.push(text(`${order.customerName}\n\n`));
  } else {
    parts.push(text(`Sem Nome\n\n`));
  }

  // Items
  for (const item of order.items) {
    const qty = item.weight ? `${item.weight.toFixed(3)}kg` : `${item.quantity}`;
    parts.push(CMD_BOLD_ON, text(`${qty} ${item.name}\n`), CMD_BOLD_OFF);
    if (item.notes) parts.push(text(`  *${item.notes}\n`));
  }

  parts.push(text('\n\n'));
  parts.push(text('Atendente do Pedido:\n'));
  parts.push(text(`${order.operatorName || 'Não informado'}\n`));
  
  parts.push(feedAndCut());

  return concat(...parts);
}

/**
 * Build a CONTA (bill / receipt for customer after payment).
 */
export function buildBillReceipt(bill: BillData, paperWidth = 80): Uint8Array {
  const cols = colsForWidth(paperWidth);
  const parts: Uint8Array[] = [
    CMD_INIT,
    CMD_CODEPAGE_PC860,
    CMD_ALIGN_CENTER,
    CMD_BOLD_ON, CMD_DOUBLE_ON,
    text('CONTA\n'),
    CMD_DOUBLE_OFF, CMD_BOLD_OFF,
    CMD_ALIGN_LEFT,
    lineOf('=', cols),
    row('Tipo:', orderTypeLabels[bill.orderType] || bill.orderType, cols),
  ];

  if (bill.tableNumber) parts.push(row('Mesa:', String(bill.tableNumber), cols));
  if (bill.customerName) parts.push(row('Cliente:', bill.customerName, cols));
  parts.push(row('Data:', fmtDate(bill.createdAt), cols));
  parts.push(lineOf('-', cols));

  // Items with price
  for (const item of bill.items) {
    const qty = item.weight ? `${item.weight.toFixed(3)}kg` : `${item.quantity}x`;
    parts.push(row(`${qty} ${item.name}`, fmtBRL(item.subtotal), cols));
  }

  parts.push(lineOf('-', cols));

  if (bill.discount && bill.discount > 0) {
    const discLabel = bill.discountType === 'percentage' ? `Desconto (${bill.discount}%)` : 'Desconto';
    parts.push(row(discLabel, `-${fmtBRL(bill.discountType === 'percentage' ? bill.total * bill.discount / 100 : bill.discount)}`, cols));
  }
  if (bill.serviceFee && bill.serviceFee > 0) {
    parts.push(row('Taxa de serviço', fmtBRL(bill.serviceFee), cols));
  }
  if (bill.deliveryFee && bill.deliveryFee > 0) {
    parts.push(row('Taxa de entrega', fmtBRL(bill.deliveryFee), cols));
  }

  parts.push(lineOf('=', cols));
  parts.push(CMD_BOLD_ON, CMD_DOUBLE_ON);
  parts.push(row('TOTAL', fmtBRL(bill.total), cols));
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

  parts.push(lineOf('=', cols));
  parts.push(CMD_ALIGN_CENTER, text('Obrigado pela preferencia!\n'));
  parts.push(feedAndCut());

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
  parts.push(CMD_BOLD_ON, CMD_DOUBLE_ON);
  parts.push(row('TOTAL VENDAS', fmtBRL(data.totalSales), cols));
  parts.push(CMD_DOUBLE_OFF, CMD_BOLD_OFF);

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
