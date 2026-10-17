import { describe, it, expect } from 'vitest';
import { mergePrintedFlags, excludeAlreadySent } from '@/lib/printed-guard';
describe('printed guard', () => {
  it('keeps printed true when local copy is stale', () => {
    const r = mergePrintedFlags([{ id: 'a', printed: false }, { id: 'b', printed: false }], [{ id: 'a', printed: true }]);
    expect(r.map(i => i.printed)).toEqual([true, false]);
  });
  it('drops items already sent to the kitchen', () => {
    expect(excludeAlreadySent([{ id: 'a' }, { id: 'b' }], new Set(['a'])).map(i => i.id)).toEqual(['b']);
  });
});
