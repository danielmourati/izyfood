/** Interpret only the formatting commands emitted by our receipt builders.
 * UTF-8 here is solely for browser rendering; physical printers keep calibration.
 */
interface ReceiptLine {
  text: string;
  bold: boolean;
  double: boolean;
  align: 'left' | 'center' | 'right';
}

export function receiptLines(bytes: Uint8Array): ReceiptLine[] {
  const lines: ReceiptLine[] = [];
  let bold = false;
  let double = false;
  let align: ReceiptLine['align'] = 'left';
  let content: number[] = [];
  let lineStyle: Omit<ReceiptLine, 'text'> = { bold, double, align };
  const flush = () => {
    lines.push({ text: new TextDecoder().decode(new Uint8Array(content)), ...lineStyle });
    content = [];
    lineStyle = { bold, double, align };
  };
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i];
    if (byte === 0x1b || byte === 0x1d) {
      const command = bytes[i + 1];
      const value = bytes[i + 2];
      if (byte === 0x1b && command === 0x40) {
        bold = false; double = false; align = 'left'; i += 1;
      } else {
        if (byte === 0x1b && command === 0x45) bold = value === 1;
        if (byte === 0x1b && command === 0x61) align = value === 1 ? 'center' : value === 2 ? 'right' : 'left';
        if (byte === 0x1d && command === 0x21) double = value === 0x11;
        i += 2;
      }
      if (content.length === 0) lineStyle = { bold, double, align };
    } else if (byte === 0x0a) {
      flush();
    } else if (byte >= 0x20) {
      if (content.length === 0) lineStyle = { bold, double, align };
      content.push(byte);
    }
  }
  if (content.length) flush();
  while (lines.at(-1)?.text === '') lines.pop();
  return lines;
}

export function receiptPlainText(bytes: Uint8Array, columns: number): string {
  return receiptLines(bytes).map(line => {
    const width = line.double ? Math.floor(columns / 2) : columns;
    const gap = Math.max(0, width - line.text.length);
    const padding = line.align === 'center' ? Math.floor(gap / 2) : line.align === 'right' ? gap : 0;
    return ' '.repeat(padding) + line.text;
  }).join('\n');
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function receiptHtml(bytes: Uint8Array, columns: number): string {
  const lines = receiptLines(bytes).map(line => {
    const className = `receipt-line${line.double ? ' receipt-double' : ''}${line.bold ? ' receipt-bold' : ''}`;
    return `<div class="${className}" style="text-align:${line.align}">${escapeHtml(line.text) || '&#8203;'}</div>`;
  }).join('');
  return `<div class="thermal-receipt" style="--receipt-columns:${columns}">${lines}</div>`;
}

/** Shared by in-app previews and the browser print document. Colors inherit. */
export const RECEIPT_HTML_STYLES = `
  .thermal-receipt { font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.15; letter-spacing: 0; width: calc(var(--receipt-columns) * 1ch); margin: 0 auto; }
  .thermal-receipt .receipt-line { white-space: pre; min-height: 1.15em; margin: 0; padding: 0; }
  .thermal-receipt .receipt-bold { font-weight: 700; }
  .thermal-receipt .receipt-double { font-size: 2em; line-height: 1.15; }
`;