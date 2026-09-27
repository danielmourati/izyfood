import { describe, expect, it } from 'vitest';

import { formatBRLInput, maskBRLInput, parseBRLInput } from '@/lib/utils';

describe('BRL input helpers', () => {
  it('masks typed digits as Brazilian currency', () => {
    expect(maskBRLInput('3')).toMatch(/^R\$\s?0,03$/);
    expect(maskBRLInput('300')).toMatch(/^R\$\s?3,00$/);
    expect(maskBRLInput('123456')).toMatch(/^R\$\s?1\.234,56$/);
  });

  it('parses masked values without floating point text ambiguity', () => {
    expect(parseBRLInput('R$ 1.234,56')).toBe(1234.56);
    expect(parseBRLInput('R$ 0,03')).toBe(0.03);
    expect(parseBRLInput('')).toBe(0);
  });

  it('formats existing numeric values with two decimal places', () => {
    expect(formatBRLInput(3)).toMatch(/^R\$\s?3,00$/);
    expect(formatBRLInput(1234.5)).toMatch(/^R\$\s?1\.234,50$/);
  });
});