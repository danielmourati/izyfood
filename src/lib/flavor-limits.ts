import type { ProductCategory, SelectedComplement } from '@/types';

export interface FlavorLimitState {
  count: number;
  label: string;
  canAddMore: boolean;
  canConfirm: boolean;
  missingMessage: string;
}

/** Counts selected flavors (only complements chosen as flavor) against the category limits. */
export function getFlavorLimitState(
  category: Pick<ProductCategory, 'flavorRequired' | 'flavorMin' | 'flavorMax'> | undefined,
  selected: SelectedComplement[],
): FlavorLimitState {
  const count = selected.filter(c => c.classification === 'flavor').reduce((s, c) => s + (c.quantity || 1), 0);
  const max = category?.flavorMax ?? null;
  const min = category?.flavorRequired ? Math.max(category?.flavorMin ?? 1, 1) : 0;
  let label = '';
  if (max != null && min === max) label = `escolha ${max}`;
  else if (max != null && min > 0) label = `escolha de ${min} a ${max}`;
  else if (max != null) label = `até ${max}`;
  else if (min > 0) label = `mínimo ${min}`;
  const canAddMore = max == null || count < max;
  const canConfirm = count >= min && (max == null || count <= max);
  const missing = Math.max(min - count, 0);
  const missingMessage = missing > 0 ? `Escolha mais ${missing} sabor${missing > 1 ? 'es' : ''}.` : '';
  return { count, label, canAddMore, canConfirm, missingMessage };
}
