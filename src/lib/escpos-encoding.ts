/**
 * Character encodings for ESC/POS thermal printers.
 *
 * Thermal printers interpret text bytes through a single-byte character table
 * selected with `ESC t n`. The index `n` differs between brands/firmwares, so
 * each printer stores a calibrated `char_encoding` id (chosen via the printed
 * "Teste de acentuação" page) instead of relying on UTF-8.
 */

const CP850_HIGH = "\u00c7\u00fc\u00e9\u00e2\u00e4\u00e0\u00e5\u00e7\u00ea\u00eb\u00e8\u00ef\u00ee\u00ec\u00c4\u00c5\u00c9\u00e6\u00c6\u00f4\u00f6\u00f2\u00fb\u00f9\u00ff\u00d6\u00dc\u00f8\u00a3\u00d8\u00d7\u0192\u00e1\u00ed\u00f3\u00fa\u00f1\u00d1\u00aa\u00ba\u00bf\u00ae\u00ac\u00bd\u00bc\u00a1\u00ab\u00bb\u2591\u2592\u2593\u2502\u2524\u00c1\u00c2\u00c0\u00a9\u2563\u2551\u2557\u255d\u00a2\u00a5\u2510\u2514\u2534\u252c\u251c\u2500\u253c\u00e3\u00c3\u255a\u2554\u2569\u2566\u2560\u2550\u256c\u00a4\u00f0\u00d0\u00ca\u00cb\u00c8\u0131\u00cd\u00ce\u00cf\u2518\u250c\u2588\u2584\u00a6\u00cc\u2580\u00d3\u00df\u00d4\u00d2\u00f5\u00d5\u00b5\u00fe\u00de\u00da\u00db\u00d9\u00fd\u00dd\u00af\u00b4\u00ad\u00b1\u2017\u00be\u00b6\u00a7\u00f7\u00b8\u00b0\u00a8\u00b7\u00b9\u00b3\u00b2\u25a0\u00a0";
const CP860_HIGH = "\u00c7\u00fc\u00e9\u00e2\u00e3\u00e0\u00c1\u00e7\u00ea\u00ca\u00e8\u00cd\u00d4\u00ec\u00c3\u00c2\u00c9\u00c0\u00c8\u00f4\u00f5\u00f2\u00da\u00f9\u00cc\u00d5\u00dc\u00a2\u00a3\u00d9\u20a7\u00d3\u00e1\u00ed\u00f3\u00fa\u00f1\u00d1\u00aa\u00ba\u00bf\u00d2\u00ac\u00bd\u00bc\u00a1\u00ab\u00bb\u2591\u2592\u2593\u2502\u2524\u2561\u2562\u2556\u2555\u2563\u2551\u2557\u255d\u255c\u255b\u2510\u2514\u2534\u252c\u251c\u2500\u253c\u255e\u255f\u255a\u2554\u2569\u2566\u2560\u2550\u256c\u2567\u2568\u2564\u2565\u2559\u2558\u2552\u2553\u256b\u256a\u2518\u250c\u2588\u2584\u258c\u2590\u2580\u03b1\u00df\u0393\u03c0\u03a3\u03c3\u00b5\u03c4\u03a6\u0398\u03a9\u03b4\u221e\u03c6\u03b5\u2229\u2261\u00b1\u2265\u2264\u2320\u2321\u00f7\u2248\u00b0\u2219\u00b7\u221a\u207f\u00b2\u25a0\u00a0";
const CP1252_HIGH = "\u20ac\ufffd\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\ufffd\u017d\ufffd\ufffd\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\ufffd\u017e\u0178\u00a0\u00a1\u00a2\u00a3\u00a4\u00a5\u00a6\u00a7\u00a8\u00a9\u00aa\u00ab\u00ac\u00ad\u00ae\u00af\u00b0\u00b1\u00b2\u00b3\u00b4\u00b5\u00b6\u00b7\u00b8\u00b9\u00ba\u00bb\u00bc\u00bd\u00be\u00bf\u00c0\u00c1\u00c2\u00c3\u00c4\u00c5\u00c6\u00c7\u00c8\u00c9\u00ca\u00cb\u00cc\u00cd\u00ce\u00cf\u00d0\u00d1\u00d2\u00d3\u00d4\u00d5\u00d6\u00d7\u00d8\u00d9\u00da\u00db\u00dc\u00dd\u00de\u00df\u00e0\u00e1\u00e2\u00e3\u00e4\u00e5\u00e6\u00e7\u00e8\u00e9\u00ea\u00eb\u00ec\u00ed\u00ee\u00ef\u00f0\u00f1\u00f2\u00f3\u00f4\u00f5\u00f6\u00f7\u00f8\u00f9\u00fa\u00fb\u00fc\u00fd\u00fe\u00ff";

const ESC = 0x1B;

type TableName = 'cp850' | 'cp860' | 'cp1252' | 'utf8' | 'ascii';

function buildMap(high: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < high.length; i++) {
    const ch = high[i];
    if (ch !== '\ufffd' && !m.has(ch)) m.set(ch, 0x80 + i);
  }
  return m;
}

const MAPS: Record<'cp850' | 'cp860' | 'cp1252', Map<string, number>> = {
  cp850: buildMap(CP850_HIGH),
  cp860: buildMap(CP860_HIGH),
  cp1252: buildMap(CP1252_HIGH),
};

const HIGHS: Record<'cp850' | 'cp860' | 'cp1252', string> = {
  cp850: CP850_HIGH,
  cp860: CP860_HIGH,
  cp1252: CP1252_HIGH,
};

/** Simple replacements for symbols that have no equivalent in the table. */
const FALLBACKS: Record<string, string> = {
  '\u2013': '-', '\u2014': '-', '\u2212': '-', '\u2010': '-', '\u2011': '-',
  '\u2018': "'", '\u2019': "'", '\u201a': "'", '\u201c': '"', '\u201d': '"', '\u201e': '"',
  '\u2026': '...', '\u2022': '*', '\u00b7': '.', '\u00a0': ' ', '\u2009': ' ', '\u202f': ' ',
  '\u00ba': 'o', '\u00aa': 'a', '\u00b0': 'o', '\u20ac': 'EUR', '\u00bd': '1/2', '\u00bc': '1/4',
  '\u00be': '3/4', '\u00d7': 'x', '\u00f7': '/', '\u00ab': '"', '\u00bb': '"',
};

const utf8Encoder = new TextEncoder();

/** Remove diacritics and replace unsupported symbols with ASCII. */
export function toAscii(s: string): string {
  let out = '';
  for (const ch of s.normalize('NFC')) {
    const code = ch.codePointAt(0)!;
    if (code < 0x80) { out += ch; continue; }
    if (FALLBACKS[ch] !== undefined) { out += FALLBACKS[ch]; continue; }
    const stripped = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (stripped && /^[\x00-\x7f]+$/.test(stripped)) { out += stripped; continue; }
    if (ch === '\u00df') { out += 'ss'; continue; }
    if (ch === '\u00e6') { out += 'ae'; continue; }
    if (ch === '\u00c6') { out += 'AE'; continue; }
    if (ch === '\u00f8') { out += 'o'; continue; }
    if (ch === '\u00d8') { out += 'O'; continue; }
    // emoji / unknown symbols are dropped
  }
  return out;
}

function encodeWithTable(s: string, table: TableName): Uint8Array {
  if (!s) return new Uint8Array(0);
  if (table === 'utf8') return utf8Encoder.encode(s.normalize('NFC'));
  if (table === 'ascii') {
    const a = toAscii(s);
    const out = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = a.charCodeAt(i) & 0x7f;
    return out;
  }
  const map = MAPS[table];
  const bytes: number[] = [];
  for (const ch of s.normalize('NFC')) {
    const code = ch.codePointAt(0)!;
    if (code < 0x80) { bytes.push(code); continue; }
    const b = map.get(ch);
    if (b !== undefined) { bytes.push(b); continue; }
    const fb = toAscii(ch);
    for (let i = 0; i < fb.length; i++) bytes.push(fb.charCodeAt(i) & 0x7f);
  }
  return new Uint8Array(bytes);
}

/** Decode bytes produced by `encodeWithTable` (used by tests and diagnostics). */
export function decodeWithTable(bytes: Uint8Array, table: TableName): string {
  if (table === 'utf8') return new TextDecoder('utf-8').decode(bytes);
  if (table === 'ascii') return String.fromCharCode(...Array.from(bytes));
  const high = HIGHS[table];
  let out = '';
  for (const b of bytes) out += b < 0x80 ? String.fromCharCode(b) : high[b - 0x80];
  return out;
}

export interface CharEncoding {
  id: string;
  label: string;
  /** ASCII-only label printed on the calibration page. */
  testLabel: string;
  table: TableName;
  /** `ESC t n` command (empty = keep the printer's factory table). */
  command: Uint8Array;
}

export const DEFAULT_CHAR_ENCODING = 'cp850';

export const CHAR_ENCODINGS: CharEncoding[] = [
  { id: 'cp850', label: 'CP850 (recomendado)', testLabel: 'CP850 (ESC t 2)', table: 'cp850', command: new Uint8Array([ESC, 0x74, 2]) },
  { id: 'cp860_epson', label: 'CP860 Português (Epson / Elgin)', testLabel: 'CP860 Epson/Elgin (ESC t 3)', table: 'cp860', command: new Uint8Array([ESC, 0x74, 3]) },
  { id: 'cp860_bematech', label: 'CP860 Português (Bematech)', testLabel: 'CP860 Bematech (ESC t 4)', table: 'cp860', command: new Uint8Array([ESC, 0x74, 4]) },
  { id: 'cp1252', label: 'Windows-1252', testLabel: 'Windows-1252 (ESC t 16)', table: 'cp1252', command: new Uint8Array([ESC, 0x74, 16]) },
  { id: 'cp850_raw', label: 'CP850 sem comando (tabela de fábrica)', testLabel: 'CP850 tabela de fabrica', table: 'cp850', command: new Uint8Array(0) },
  { id: 'utf8', label: 'UTF-8 (somente impressoras compatíveis)', testLabel: 'UTF-8 (ESC t 8)', table: 'utf8', command: new Uint8Array([ESC, 0x74, 8]) },
  { id: 'ascii', label: 'Sem acentos (funciona em qualquer impressora)', testLabel: 'Sem acentos', table: 'ascii', command: new Uint8Array(0) },
];

export function getCharEncoding(id?: string | null): CharEncoding {
  return CHAR_ENCODINGS.find(e => e.id === id)
    ?? CHAR_ENCODINGS.find(e => e.id === DEFAULT_CHAR_ENCODING)!;
}

export function encodeText(s: string, encoding: CharEncoding | string = DEFAULT_CHAR_ENCODING): Uint8Array {
  const enc = typeof encoding === 'string' ? getCharEncoding(encoding) : encoding;
  return encodeWithTable(s, enc.table);
}

export function decodeText(bytes: Uint8Array, encoding: CharEncoding | string = DEFAULT_CHAR_ENCODING): string {
  const enc = typeof encoding === 'string' ? getCharEncoding(encoding) : encoding;
  return decodeWithTable(bytes, enc.table);
}

export const ENCODING_TEST_SAMPLE = 'Ação Pão Coração Maçã Café Açaí Ônibus';
