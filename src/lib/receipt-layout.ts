/** Menuzin-style hanging indents with bounded, hyphenated continuation lines. */
export function wrapReceiptText(text: string, cols: number, firstPrefix = '', hangIndent = 0): string[] {
  const width = Math.max(4, Math.floor(cols));
  const hang = Math.min(Math.max(0, hangIndent), width - 3);
  const pad = ' '.repeat(hang);
  const out: string[] = [];
  let current = firstPrefix.length <= width - 2 ? firstPrefix : '';
  if (!current && firstPrefix) out.push(...wrapReceiptText(firstPrefix.trim(), width));
  let lineStart = current;
  const flush = () => {
    if (current.trim()) out.push(current.trimEnd());
    current = pad;
    lineStart = pad;
  };
  for (const original of String(text ?? '').normalize('NFC').split(/\s+/).filter(Boolean)) {
    let word = original;
    while (word) {
      const empty = current === lineStart;
      const gap = empty ? '' : ' ';
      if (current.length + gap.length + word.length <= width) {
        current += gap + word;
        break;
      }
      if (empty && current.length > hang && word.length <= width - hang) {
        flush();
        continue;
      }
      const room = width - current.length - gap.length;
      if (word.length > width - hang && room >= 3) {
        const take = room - 1;
        current += gap + word.slice(0, take) + '-';
        word = word.slice(take);
      } else if (empty) {
        const take = Math.max(1, width - current.length);
        current += word.slice(0, take);
        word = word.slice(take);
      }
      flush();
    }
  }
  if (current.trim()) out.push(current.trimEnd());
  return out.length ? out : [''];
}