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
  it('product flavor limits override category flavor limits when enabled on product', () => {
    const categoryRule = { flavorRequired: true, flavorMin: 1, flavorMax: 2 };
    const productRule = { flavorRequired: true, flavorMin: 4, flavorMax: 4 };
    const s2 = getFlavorLimitState(categoryRule, [f('a'), f('b')], productRule);
    expect(s2.canConfirm).toBe(false);
    expect(s2.canAddMore).toBe(true);
    expect(s2.max).toBe(4);
    expect(s2.min).toBe(4);
    expect(s2.label).toBe('escolha 4');

    const s4 = getFlavorLimitState(categoryRule, [f('a'), f('b'), f('c'), f('d')], productRule);
    expect(s4.canConfirm).toBe(true);
    expect(s4.canAddMore).toBe(false);
  });
  it('falls back to category flavor limits when product does not enable flavor limits', () => {
    const categoryRule = { flavorRequired: true, flavorMin: 2, flavorMax: 2 };
    const productWithoutRule = { flavorRequired: false, flavorMin: null, flavorMax: null };
    const s = getFlavorLimitState(categoryRule, [f('a')], productWithoutRule);
    expect(s.canConfirm).toBe(false);
    expect(s.max).toBe(2);
    expect(s.label).toBe('escolha 2');
  });
});
