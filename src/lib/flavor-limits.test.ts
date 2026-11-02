import { describe, it, expect } from 'vitest';
import { getFlavorLimitState } from './flavor-limits';

const f = (name: string, classification: 'flavor' | 'additional' = 'flavor') => ({ name, price: 0, quantity: 1, classification });

describe('getFlavorLimitState', () => {
  it('max 3 blocks a 4th flavor', () => {
    expect(getFlavorLimitState({ flavorMax: 3 }, [f('a'), f('b'), f('c')]).canAddMore).toBe(false);
  });
  it('required min 3 blocks confirming with 2', () => {
    const s = getFlavorLimitState({ flavorRequired: true, flavorMin: 3, flavorMax: 3 }, [f('a'), f('b')]);
    expect(s.canConfirm).toBe(false);
    expect(s.label).toBe('escolha 3');
  });
  it('no limit allows everything', () => {
    const s = getFlavorLimitState(undefined, [f('a'), f('b'), f('c'), f('d')]);
    expect(s.canAddMore && s.canConfirm).toBe(true);
  });
  it('options picked as additional do not count', () => {
    expect(getFlavorLimitState({ flavorMax: 1 }, [f('a'), f('b', 'additional')]).count).toBe(1);
  });
});
