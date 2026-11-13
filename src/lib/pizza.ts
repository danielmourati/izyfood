import type { CategoryPizzaSize, PizzaSizeConfig, Product, ProductCategory, SelectedComplement } from '@/types';

export const DEFAULT_PIZZA_SIZES: CategoryPizzaSize[] = [
  { id: 'P', name: 'Pequena (P)', maxFlavors: 1 },
  { id: 'M', name: 'Média (M)', maxFlavors: 2 },
  { id: 'G', name: 'Grande (G)', maxFlavors: 3 },
  { id: 'GG', name: 'Família (GG)', maxFlavors: 4 },
];

export const DEFAULT_CALZONE_SIZES: CategoryPizzaSize[] = [
  { id: 'M', name: 'Médio (M)', maxFlavors: 2 },
  { id: 'G', name: 'Grande (G)', maxFlavors: 3 },
];

/** Returns true when a category name matches pizza or calzone keywords. */
export function isPizzaOrCalzoneName(name?: string | null): boolean {
  const norm = (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  return /\b(pizzas?|calzones?)\b/.test(norm);
}

/** Checks whether a category uses the Pizza/Calzone multi-size & multi-flavor flow. */
export function isPizzaOrCalzoneCategory(category?: ProductCategory | null): boolean {
  if (!category) return false;
  if (category.isPizzaCategory !== undefined) {
    return Boolean(category.isPizzaCategory);
  }
  return isPizzaOrCalzoneName(category.name);
}

/** Returns the default size templates for a category based on its name or stored config. */
export function getCategoryPizzaSizes(category?: ProductCategory | null): CategoryPizzaSize[] {
  if (category?.pizzaSizes && category.pizzaSizes.length > 0) {
    return category.pizzaSizes;
  }
  const norm = (category?.name || '').toLowerCase();
  if (norm.includes('calzone')) {
    return DEFAULT_CALZONE_SIZES;
  }
  return DEFAULT_PIZZA_SIZES;
}

/**
 * Resolves the full list of size configurations for a product in a pizza/calzone category,
 * merging the category's sizes with the product's saved `pizzaSizes`.
 */
export function buildProductPizzaSizesForForm(
  category: ProductCategory | undefined | null,
  existingSizes?: PizzaSizeConfig[],
  fallbackPrice = 0,
  fallbackMaxFlavors?: number | null,
): PizzaSizeConfig[] {
  const catSizes = getCategoryPizzaSizes(category);
  const existingMap = new Map<string, PizzaSizeConfig>();
  for (const s of existingSizes || []) {
    existingMap.set(s.id.toUpperCase(), s);
  }

  const merged: PizzaSizeConfig[] = catSizes.map((cs, idx) => {
    const found = existingMap.get(cs.id.toUpperCase());
    if (found) {
      return {
        id: cs.id,
        name: cs.name,
        maxFlavors: Math.max(1, Math.min(4, Number(found.maxFlavors) || cs.maxFlavors)),
        price: Number(found.price) >= 0 ? Number(found.price) : fallbackPrice,
        active: found.active !== false,
      };
    }
    return {
      id: cs.id,
      name: cs.name,
      maxFlavors: fallbackMaxFlavors != null && fallbackMaxFlavors >= 1
        ? Math.min(4, fallbackMaxFlavors)
        : cs.maxFlavors,
      price: fallbackPrice > 0 ? fallbackPrice : 0,
      active: existingSizes && existingSizes.length > 0 ? false : idx === 0 || fallbackPrice > 0,
    };
  });

  // Preserve any custom size configured directly on the product
  for (const s of existingSizes || []) {
    if (!merged.some(m => m.id.toUpperCase() === s.id.toUpperCase())) {
      merged.push({
        id: s.id,
        name: s.name,
        maxFlavors: Math.max(1, Math.min(4, Number(s.maxFlavors) || 1)),
        price: Number(s.price) || 0,
        active: s.active !== false,
      });
    }
  }

  return merged;
}

/**
 * Returns the active pizza sizes available for a product at order time.
 * If the product has no explicit `pizzaSizes` saved yet, falls back to the category sizes using `product.price`.
 */
export function getActiveProductPizzaSizes(
  product: Product,
  category?: ProductCategory | null,
): PizzaSizeConfig[] {
  if (Array.isArray(product.pizzaSizes) && product.pizzaSizes.length > 0) {
    const active = product.pizzaSizes.filter(s => s.active !== false);
    if (active.length > 0) return active;
  }
  const catSizes = getCategoryPizzaSizes(category);
  const explicitMax = product.flavorMax != null && product.flavorMax >= 1 ? Math.min(4, product.flavorMax) : null;
  return catSizes.map(cs => ({
    id: cs.id,
    name: cs.name,
    maxFlavors: explicitMax ?? cs.maxFlavors,
    price: product.price || 0,
    active: true,
  }));
}

/** Returns the minimum active price of a product across its configured pizza sizes. */
export function getMinimumProductPrice(product: Product, category?: ProductCategory | null): number {
  if (!isPizzaOrCalzoneCategory(category) && (!product.pizzaSizes || product.pizzaSizes.length === 0)) {
    return product.price || 0;
  }
  const activeSizes = getActiveProductPizzaSizes(product, category);
  const positivePrices = activeSizes.map(s => s.price).filter(p => p > 0);
  if (positivePrices.length === 0) return product.price || 0;
  return Math.min(...positivePrices);
}

/** Returns true if a product can be selected as a flavor option in multi-flavor pizzas/combos. */
export function isProductPizzaFlavor(product: Product): boolean {
  if (product.isCombo) return false;
  if (product.isPizzaFlavor === false) return false;
  return true;
}

/**
 * Computes the allowed flavor counts ("quantos sabores?") for an item & size,
 * respecting both the size's `maxFlavors` and the product's `flavorMin` / `flavorMax` (1..4).
 */
export function getAllowedFlavorCountsForItem(
  product: Product | null | undefined,
  size: { maxFlavors: number } | undefined,
): number[] {
  const sizeMax = Math.max(1, Math.min(4, size?.maxFlavors || 1));
  if (!product) {
    return Array.from({ length: sizeMax }, (_, i) => i + 1);
  }
  const prodMax =
    product.flavorMax != null && product.flavorMax >= 1
      ? Math.min(4, product.flavorMax)
      : sizeMax;
  const effectiveMax = Math.max(1, Math.min(sizeMax, prodMax));
  const rawMin =
    product.flavorMin != null && product.flavorMin >= 1
      ? Math.min(4, product.flavorMin)
      : 1;
  const effectiveMin = Math.max(1, Math.min(effectiveMax, rawMin));

  const counts: number[] = [];
  for (let n = effectiveMin; n <= effectiveMax; n += 1) {
    counts.push(n);
  }
  return counts;
}

/**
 * Calculates the final base price for a pizza when 1 or more flavors are chosen,
 * using the HIGHEST price among the selected flavors (standard pizzeria rule).
 */
export function calculatePizzaHighestPrice(flavors: { price: number }[]): number {
  if (!flavors || flavors.length === 0) return 0;
  return Math.max(0, ...flavors.map(f => Number(f.price) || 0));
}

/** Formats a flavor line with fractional prefix when 2 or more flavors are chosen (e.g. "1/2 Calabresa"). */
export function formatPizzaFlavorName(flavorName: string, totalFlavors: number): string {
  const clean = String(flavorName || '').trim();
  if (totalFlavors <= 1) return clean;
  return `1/${totalFlavors} ${clean}`;
}

/**
 * Builds the synthetic Product and pre-selected flavor complements to pass into ConsumerItemCustomizeModal
 * after the attendant selects the size, flavor count, and flavors.
 */
export function buildAssembledPizzaSelection(params: {
  category: ProductCategory;
  size: CategoryPizzaSize;
  flavorCount: number;
  selectedProducts: { product: Product; sizePrice: number }[];
  baseItem?: Product | null;
  baseItemSizePrice?: number;
}): {
  assembledProduct: Product;
  selectedFlavorComplements: SelectedComplement[];
  basePrice: number;
} {
  const { category, size, flavorCount, selectedProducts, baseItem, baseItemSizePrice } = params;
  const primaryProduct = selectedProducts[0]?.product || baseItem || undefined;
  const highestFlavorPrice = calculatePizzaHighestPrice(selectedProducts.map(sp => ({ price: sp.sizePrice })));
  const basePrice = baseItem?.isCombo && (baseItemSizePrice ?? 0) > 0
    ? Math.max(baseItemSizePrice || 0, highestFlavorPrice)
    : highestFlavorPrice;

  const isCalzone = (category.name || '').toLowerCase().includes('calzone');
  const prefix = isCalzone ? 'Calzone' : 'Pizza';
  const totalFlavors = Math.max(1, selectedProducts.length);

  const itemTitle = baseItem?.isCombo
    ? `${baseItem.name} - ${size.name}`
    : totalFlavors === 1 && primaryProduct
      ? `${prefix} ${size.name} - ${primaryProduct.name}`
      : `${prefix} ${size.name} (${totalFlavors} Sabores)`;

  const descriptionParts = selectedProducts
    .map(sp => sp.product.name)
    .join(' + ');

  const assembledProduct: Product = {
    ...(baseItem || primaryProduct || {
      id: `pizza-${category.id}-${size.id}`,
      categoryId: category.id,
      type: 'unit',
      unit: 'un',
      stock: 999,
      loyaltyEligible: false,
      controlStock: false,
    }),
    name: itemTitle,
    description: descriptionParts,
    price: basePrice,
    flavorRequired: true,
    flavorMin: totalFlavors,
    flavorMax: Math.max(flavorCount, totalFlavors),
  };

  const selectedFlavorComplements: SelectedComplement[] = selectedProducts.map(sp => ({
    name: formatPizzaFlavorName(sp.product.name, totalFlavors),
    price: 0,
    quantity: 1,
    classification: 'flavor',
  }));

  return {
    assembledProduct,
    selectedFlavorComplements,
    basePrice,
  };
}

