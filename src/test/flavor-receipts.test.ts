import { describe, expect, it } from 'vitest';
import { buildBillReceipt, buildOrderReceipt, kitchenItemColumns } from '@/lib/escpos';
import { receiptLines, receiptPlainText, receiptHtml } from '@/lib/receipt-renderer';
import { getOrderItemCustomizationGroups, isObservationOption, sortObservationsFirst } from '@/lib/utils';
import {
  buildAssembledPizzaSelection,
  calculatePizzaHighestPrice,
  getAllowedFlavorCountsForItem,
  getMinimumProductPrice,
  isPizzaOrCalzoneCategory,
  isProductPizzaFlavor,
} from '@/lib/pizza';
import type { Product, ProductCategory } from '@/types';

const order = {
  id: 'flavors-test', orderType: 'mesa', tableNumber: 2, total: 24,
  openedByName: 'Ana', createdAt: '2026-10-12T19:00:00Z',
  items: [{ name: 'Pastel', price: 20, subtotal: 24, quantity: 1,
    selectedComplements: [
      { name: 'Carne', price: 0, quantity: 1, classification: 'flavor' as const },
      { name: 'Queijo', price: 0, quantity: 1, classification: 'flavor' as const },
      { name: 'Azeitona', price: 0, quantity: 1, classification: 'additional' as const },
      { name: 'Bacon', price: 2, quantity: 2, classification: 'additional' as const },
    ],
  }],
};

describe('flavor and additional receipts', () => {
  it.each([55, 58, 80])('keeps groups bold and quantities correct at %s mm', width => {
    for (const doubleFontOrders of [false, true]) {
      for (const bytes of [buildOrderReceipt(order, width, { doubleFontOrders }, 'utf8'), buildBillReceipt(order, width, undefined, 'utf8')]) {
        const plain = receiptPlainText(bytes, width <= 58 ? 32 : 42);
        expect(plain).toContain('Sabores:');
        expect(plain).toContain('Adicionais:');
        expect(plain).toContain('- Carne');
        expect(plain).toContain('- Queijo');
        expect(plain).toContain('- Azeitona');
        expect(plain).toContain('- 2x Bacon');
        expect(plain).not.toMatch(/1x (Carne|Queijo|Azeitona)/);
        const lines = receiptLines(bytes);
        expect(lines.filter(line => /Sabores:|Adicionais:/.test(line.text)).every(line => line.bold)).toBe(true);
        expect(receiptHtml(bytes, width <= 58 ? 32 : 42)).toContain('Sabores:');
        for (const line of lines.filter(line => line.double)) expect(line.text.length).toBeLessThanOrEqual(kitchenItemColumns(width, true));
      }
    }
  });
  it('does not reclassify historical items or show empty groups', () => {
    expect(getOrderItemCustomizationGroups({ selectedComplements: [{ name: 'Carne', quantity: 1, price: 0 }] }).map(group => group.title)).toEqual(['Adicionais:']);
    expect(getOrderItemCustomizationGroups({})).toEqual([]);
    const snapshot = JSON.parse(JSON.stringify(order.items[0]));
    expect(getOrderItemCustomizationGroups(snapshot)[0].items).toHaveLength(2);
  });
  it('separates Observações at the top and keeps Pra Viagem first', () => {
    const groups = getOrderItemCustomizationGroups({
      selectedNotes: ['Sem cebola'],
      selectedComplements: [
        { name: 'Carne', quantity: 1, price: 0, classification: 'flavor' },
        { name: 'Batata palha', quantity: 1, price: 0, classification: 'additional' },
        { name: 'Pra Viagem', quantity: 1, price: 0 },
      ],
    });
    expect(groups.map(g => g.title)).toEqual(['Observações:', 'Sabores:', 'Adicionais:']);
    expect(groups[0].items.map(i => i.name)).toEqual(['Pra Viagem', 'Sem cebola']);
    expect(groups[2].items.map(i => i.name)).toEqual(['Batata palha']);

    const sorted = sortObservationsFirst([
      { name: 'Sem gelo' },
      { name: '[Pra Viagem]' },
      { name: 'Bem passado' },
    ]);
    expect(sorted.map(o => o.name)).toEqual(['[Pra Viagem]', 'Sem gelo', 'Bem passado']);
    expect(isObservationOption({ name: 'Pra Viagem', type: 'complement', price: 0 })).toBe(true);
    expect(isObservationOption({ name: 'Cebola', type: 'complement', price: 0 })).toBe(false);
  });

  it('builds single and multi-flavor pizza selections priced by the highest flavor value', () => {
    const pizzaCat: ProductCategory = {
      id: 'cat-pizza',
      name: 'PIZZAS',
      isPizzaCategory: true,
    };
    const calabresa: Product = {
      id: 'prod-calabresa',
      name: 'Calabresa',
      description: 'pelati, muçarela, calabresa, cebola roxa, azeitonas e orégano',
      price: 40,
      categoryId: 'cat-pizza',
      type: 'unit',
      unit: 'un',
      stock: 99,
      loyaltyEligible: false,
      pizzaSizes: [
        { id: 'M', name: 'Média (M)', price: 40, maxFlavors: 2, active: true },
        { id: 'G', name: 'Grande (G)', price: 50, maxFlavors: 3, active: true },
      ],
    };
    const frangoCatupiry: Product = {
      id: 'prod-frango',
      name: 'Frango Catupiry',
      description: 'pelati, muçarela, frango desfiado, catupiry original, azeitonas e orégano',
      price: 45,
      categoryId: 'cat-pizza',
      type: 'unit',
      unit: 'un',
      stock: 99,
      loyaltyEligible: false,
      pizzaSizes: [
        { id: 'M', name: 'Média (M)', price: 45, maxFlavors: 2, active: true },
        { id: 'G', name: 'Grande (G)', price: 58, maxFlavors: 3, active: true },
      ],
    };

    expect(isPizzaOrCalzoneCategory(pizzaCat)).toBe(true);
    expect(isPizzaOrCalzoneCategory({ id: 'c2', name: 'Calzones' })).toBe(true);
    expect(isPizzaOrCalzoneCategory({ id: 'c3', name: 'Bebidas' })).toBe(false);
    expect(getMinimumProductPrice(calabresa, pizzaCat)).toBe(40);
    expect(calculatePizzaHighestPrice([{ price: 40 }, { price: 45 }])).toBe(45);

    const multi = buildAssembledPizzaSelection({
      category: pizzaCat,
      size: { id: 'M', name: 'Média (M)', maxFlavors: 2 },
      flavorCount: 2,
      selectedProducts: [
        { product: calabresa, sizePrice: 40 },
        { product: frangoCatupiry, sizePrice: 45 },
      ],
    });

    expect(multi.basePrice).toBe(45);
    expect(multi.assembledProduct.price).toBe(45);
    expect(multi.selectedFlavorComplements.map(c => c.name)).toEqual([
      '1/2 Calabresa',
      '1/2 Frango Catupiry',
    ]);

    const groups = getOrderItemCustomizationGroups({
      selectedNotes: ['[Pra Viagem]'],
      selectedComplements: [
        ...multi.selectedFlavorComplements,
        { name: 'Borda Catupiry', price: 8, quantity: 1, classification: 'additional' },
      ],
    });
    expect(groups.map(g => g.title)).toEqual(['Observações:', 'Sabores:', 'Adicionais:']);
    expect(groups[0].items.map(i => i.name)).toEqual(['[Pra Viagem]']);
    expect(groups[1].items.map(i => i.name)).toEqual(['1/2 Calabresa', '1/2 Frango Catupiry']);
    expect(groups[2].items.map(i => i.name)).toEqual(['Borda Catupiry']);
  });

  it('respects min/max flavor limits and combo/flavor flags', () => {
    const singleFlavorPizza: Product = {
      id: 'single-1',
      name: 'Calabresa',
      price: 25,
      categoryId: 'cat-pizza',
      type: 'unit',
      unit: 'un',
      stock: 10,
      loyaltyEligible: false,
      isPizzaFlavor: true,
      isCombo: false,
      pizzaSizes: [{ id: 'G', name: 'Grande (G)', price: 45, maxFlavors: 1, active: true }],
    };
    const combo2Flavors: Product = {
      id: 'combo-2',
      name: 'Combo Pizza G + Refri (até 2 sabores)',
      price: 48,
      categoryId: 'cat-pizza',
      type: 'unit',
      unit: 'un',
      stock: 10,
      loyaltyEligible: false,
      isPizzaFlavor: false,
      isCombo: true,
      flavorRequired: true,
      flavorMin: 2,
      flavorMax: 2,
      pizzaSizes: [{ id: 'G', name: 'Grande (G)', price: 48, maxFlavors: 2, active: true }],
    };

    expect(isProductPizzaFlavor(singleFlavorPizza)).toBe(true);
    expect(isProductPizzaFlavor(combo2Flavors)).toBe(false);
    expect(getAllowedFlavorCountsForItem(singleFlavorPizza, { maxFlavors: 1 })).toEqual([1]);
    expect(getAllowedFlavorCountsForItem(combo2Flavors, { maxFlavors: 2 })).toEqual([2]);
    expect(
      getAllowedFlavorCountsForItem(
        { ...combo2Flavors, flavorMin: 1, flavorMax: 2 },
        { maxFlavors: 2 },
      ),
    ).toEqual([1, 2]);

    const comboBuilt = buildAssembledPizzaSelection({
      category: { id: 'cat-pizza', name: 'PIZZAS', isPizzaCategory: true },
      size: { id: 'G', name: 'Grande (G)', maxFlavors: 2 },
      flavorCount: 2,
      selectedProducts: [
        { product: singleFlavorPizza, sizePrice: 45 },
        { product: { ...singleFlavorPizza, id: 'f2', name: 'Frango' }, sizePrice: 42 },
      ],
      baseItem: combo2Flavors,
      baseItemSizePrice: 48,
    });
    expect(comboBuilt.assembledProduct.name).toBe('Combo Pizza G + Refri (até 2 sabores) - Grande (G)');
    expect(comboBuilt.basePrice).toBe(48);
  });
});