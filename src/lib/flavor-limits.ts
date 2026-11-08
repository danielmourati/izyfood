import type { Product, ProductCategory, SelectedComplement } from '@/types';

export interface FlavorLimitState {
  count: number;
  max: number | null;
  min: number;
  label: string;
  canAddMore: boolean;
  canConfirm: boolean;
  missingMessage: string;
}

export type FlavorLimitSource = Pick<ProductCategory | Product, 'flavorRequired' | 'flavorMin' | 'flavorMax'>;

/**
 * Resolves the effective flavor limits for an item:
 * If the product has `flavorRequired` enabled (or defines `flavorMin` / `flavorMax`),
 * the product's flavor settings take priority over the category's settings.
 */
export function resolveEffectiveFlavorLimits(
  category: FlavorLimitSource | undefined,
  product?: FlavorLimitSource | null,
): FlavorLimitSource | undefined {
  const hasProductRule =
    product != null &&
    (Boolean(product.flavorRequired) || product.flavorMin != null || product.flavorMax != null);

  if (hasProductRule) {
    return {
      flavorRequired: Boolean(product.flavorRequired),
      flavorMin: product.flavorMin ?? null,
      flavorMax: product.flavorMax ?? null,
    };
  }
  return category;
}

/** Counts selected flavors (only complements chosen as flavor) against the effective limits (product overrides category). */
export function getFlavorLimitState(
  category: FlavorLimitSource | undefined,
  selected: SelectedComplement[],
  product?: FlavorLimitSource | null,
): FlavorLimitState {
  const effective = resolveEffectiveFlavorLimits(category, product);
  const count = selected.filter(c => c.classification === 'flavor').reduce((s, c) => s + (c.quantity || 1), 0);
  const max = effective?.flavorMax ?? null;
  const min = effective?.flavorRequired ? Math.max(effective?.flavorMin ?? 1, 1) : 0;
  let label = '';
  if (max != null && min === max) label = `escolha ${max}`;
  else if (max != null && min > 0) label = `escolha de ${min} a ${max}`;
  else if (max != null) label = `até ${max}`;
  else if (min > 0) label = `mínimo ${min}`;
  const canAddMore = max == null || count < max;
  const canConfirm = count >= min && (max == null || count <= max);
  const missing = Math.max(min - count, 0);
  const missingMessage = missing > 0 ? `Escolha mais ${missing} sabor${missing > 1 ? 'es' : ''}.` : '';
  return { count, max, min, label, canAddMore, canConfirm, missingMessage };
}
