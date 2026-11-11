import { describe, it, expect } from 'vitest';
import { getFlavorLimitState, getPreselectedFlavorsForProduct } from './flavor-limits';
import type { ProductNoteOption } from '@/types';

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
  it('allows removing or swapping preselected recipe flavors without blocking confirmation', () => {
    const categoryRule = { flavorRequired: true, flavorMin: 2, flavorMax: 2 };
    const productWithoutExplicitRule = { flavorRequired: false, flavorMin: null, flavorMax: null };
    // Product with 4 pre-selected flavors (e.g., Pernil, Queijo coalho, Orégano, Milho)
    const initial = [f('Pernil'), f('Queijo coalho'), f('Orégano'), f('Milho')];
    const sInitial = getFlavorLimitState(categoryRule, initial, productWithoutExplicitRule, 4);
    expect(sInitial.canConfirm).toBe(true);
    expect(sInitial.canAddMore).toBe(false);
    expect(sInitial.max).toBe(4);

    // Attendant removes 1 flavor (Milho) -> can confirm with 3 OR add another flavor up to 4
    const afterRemove = [f('Pernil'), f('Queijo coalho'), f('Orégano')];
    const sAfterRemove = getFlavorLimitState(categoryRule, afterRemove, productWithoutExplicitRule, 4);
    expect(sAfterRemove.canConfirm).toBe(true);
    expect(sAfterRemove.canAddMore).toBe(true);
  });
});

describe('getPreselectedFlavorsForProduct', () => {
  const catalogOptions: Pick<ProductNoteOption, 'name' | 'price' | 'type' | 'classification' | 'active' | 'categoryIds'>[] = [
    { name: 'Queijo', price: 0, type: 'complement', classification: 'flavor', active: true, categoryIds: ['cat-1'] },
    { name: 'Queijo coalho', price: 0, type: 'complement', classification: 'flavor', active: true, categoryIds: ['cat-1'] },
    { name: 'Pernil', price: 5, type: 'complement', classification: 'both', active: true, categoryIds: ['cat-1'] },
    { name: 'Orégano', price: 0, type: 'complement', classification: 'flavor', active: true, categoryIds: ['cat-1'] },
    { name: 'Milho', price: 0, type: 'complement', classification: 'flavor', active: true, categoryIds: ['cat-1'] },
    { name: 'Frango', price: 0, type: 'complement', classification: 'flavor', active: true, categoryIds: ['cat-1'] },
  ];

  it('pre-selects flavors from product description in order without double-matching substrings', () => {
    const product = {
      categoryId: 'cat-1',
      description: 'Pernil e queijo coalho c/ orégano e milho',
    };
    const res = getPreselectedFlavorsForProduct(product, catalogOptions);
    expect(res.map(r => r.name)).toEqual(['Pernil', 'Queijo coalho', 'Orégano', 'Milho']);
    expect(res.every(r => r.classification === 'flavor' && r.price === 0 && r.quantity === 1)).toBe(true);
  });

  it('uses explicit defaultFlavors when configured on the product', () => {
    const product = {
      categoryId: 'cat-1',
      description: 'Pernil e queijo coalho c/ orégano e milho',
      defaultFlavors: ['Pernil', 'Queijo coalho'],
    };
    const res = getPreselectedFlavorsForProduct(product, catalogOptions);
    expect(res.map(r => r.name)).toEqual(['Pernil', 'Queijo coalho']);
  });
});

describe('sem sabores disponíveis', () => {
  it('obrigatório sem sabores cadastrados não bloqueia', () => {
    const s = getFlavorLimitState({ flavorRequired: true, flavorMin: 2, flavorMax: 2 }, [], null, 0, 0);
    expect(s.canConfirm).toBe(true);
    expect(s.missingMessage).toBe('');
  });
  it('obrigatório com sabores cadastrados ainda exige mínimo', () => {
    expect(getFlavorLimitState({ flavorRequired: true, flavorMin: 2 }, [], null, 0, 5).canConfirm).toBe(false);
  });
  it('sem exigência não bloqueia', () => {
    expect(getFlavorLimitState({ flavorMin: 2 }, [], null, 0, 5).canConfirm).toBe(true);
  });
});

describe('recheio carne corresponde a carne moída', () => {
  const options: Pick<ProductNoteOption, 'name' | 'price' | 'type' | 'classification' | 'active' | 'categoryIds'>[] = [
    { name: 'Carne moída', price: 5, type: 'complement', classification: 'additional', active: true, categoryIds: ['cat-1'] },
    { name: 'Carne de sol', price: 6, type: 'complement', classification: 'flavor', active: true, categoryIds: ['cat-1'] },
  ];

  it('reconhece carne na descrição como carne moída da receita sem cobrar adicional', () => {
    expect(getPreselectedFlavorsForProduct({ categoryId: 'cat-1', description: 'Carne e queijo' }, options))
      .toEqual([{ name: 'Carne moída', price: 0, quantity: 1, classification: 'flavor' }]);
  });

  it('resolve carne explicitamente cadastrada nos recheios e não duplica carne moída', () => {
    expect(getPreselectedFlavorsForProduct({ categoryId: 'cat-1', defaultFlavors: ['carne', 'Carne moída'] }, options).map(c => c.name))
      .toEqual(['Carne moída']);
  });

  it('não confunde carne de sol nem carne seca com carne moída', () => {
    expect(getPreselectedFlavorsForProduct({ categoryId: 'cat-1', description: 'Carne de sol e carne seca' }, options).map(c => c.name))
      .toEqual(['Carne de sol']);
  });

  it('respeita categoria e disponibilidade do complemento', () => {
    expect(getPreselectedFlavorsForProduct({ categoryId: 'cat-2', description: 'Carne' }, options)).toEqual([]);
    expect(getPreselectedFlavorsForProduct({ categoryId: 'cat-1', description: 'Carne' }, options.map(o => ({ ...o, active: false })))).toEqual([]);
  });
});
