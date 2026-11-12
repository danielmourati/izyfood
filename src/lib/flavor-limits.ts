import type { Product, ProductCategory, ProductNoteOption, SelectedComplement } from '@/types';

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

/**
 * Counts selected flavors (only complements chosen as flavor) against the effective limits (product overrides category).
 * When a product has `preselectedFlavorCount > 0` (recipe flavors that come pre-selected),
 * the attendant can remove flavors (down to `product.flavorMin ?? 1` when required) or swap them up to `Math.max(category.flavorMax, preselectedFlavorCount)` unless `product.flavorMax` is explicitly set.
 */
export function getFlavorLimitState(
  category: FlavorLimitSource | undefined,
  selected: SelectedComplement[],
  product?: FlavorLimitSource | null,
  preselectedFlavorCount = 0,
  availableFlavorCount?: number,
): FlavorLimitState {
  const effective = resolveEffectiveFlavorLimits(category, product);
  const count = selected.filter(c => c.classification === 'flavor').reduce((s, c) => s + (c.quantity || 1), 0);

  const hasExplicitProductMax = product != null && product.flavorMax != null;
  const hasExplicitProductMin = product != null && product.flavorMin != null;

  let max = effective?.flavorMax ?? null;
  if (!hasExplicitProductMax && max != null && preselectedFlavorCount > max) {
    max = preselectedFlavorCount;
  }

  let min = 0;
  if (effective?.flavorRequired) {
    if (hasExplicitProductMin) {
      min = Math.max(product!.flavorMin ?? 1, 1);
    } else if (preselectedFlavorCount > 0) {
      min = 1;
    } else {
      min = Math.max(effective?.flavorMin ?? 1, 1);
    }
  }

  // No flavors available to pick: never block the attendant.
  if (availableFlavorCount === 0) min = 0;

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

function normalizeFlavorText(s?: string | null): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Resolves the pre-selected flavors (and free recipe complements) for a product when assembling/customizing an item.
 * 1) Uses `product.defaultFlavors` if explicitly configured by the admin.
 * 2) Otherwise, automatically matches flavors mentioned in `product.description` (e.g. "Pernil e queijo coalho c/ orégano e milho").
 * Pre-selected default flavors of a recipe are included at price 0 so the attendant can swap or remove them without inflating the base product price.
 */
export function getPreselectedFlavorsForProduct(
  product: Pick<Product, 'description' | 'categoryId' | 'defaultFlavors' | 'flavorMax'> | null | undefined,
  availableOptions: Pick<ProductNoteOption, 'name' | 'price' | 'type' | 'classification' | 'active' | 'categoryIds'>[],
  _category?: FlavorLimitSource | undefined,
): SelectedComplement[] {
  if (!product) return [];

  const categoryComplements = availableOptions.filter(
    o =>
      o.active !== false &&
      o.type === 'complement' &&
      (!product.categoryId || !o.categoryIds?.length || o.categoryIds.includes(product.categoryId))
  );

  const flavorCandidates = categoryComplements.filter(
    o => o.classification === 'flavor' || o.classification === 'both'
  );

  const explicitProductMax = product.flavorMax != null && product.flavorMax > 0 ? product.flavorMax : null;

  // 1. Explicit defaultFlavors configured on the product
  if (Array.isArray(product.defaultFlavors) && product.defaultFlavors.length > 0) {
    const explicit: SelectedComplement[] = [];
    for (const rawName of product.defaultFlavors) {
      const normTarget = normalizeFlavorText(rawName);
      if (!normTarget) continue;
      const matched = flavorCandidates.find(c => normalizeFlavorText(c.name) === normTarget)
        ?? (normTarget === 'carne'
          ? categoryComplements.find(c => normalizeFlavorText(c.name) === 'carne moida')
          : undefined);
      if (matched) {
        if (!explicit.some(c => normalizeFlavorText(c.name) === normalizeFlavorText(matched.name))) explicit.push({
          name: matched.name,
          price: 0,
          quantity: 1,
          classification: 'flavor',
        });
      }
      if (explicitProductMax != null && explicit.length >= explicitProductMax) break;
    }
    if (explicit.length > 0) return explicit;
  }

  // 2. Automatic matching from product description (e.g., "Pernil e queijo coalho c/ orégano e milho")
  const desc = normalizeFlavorText(product.description);
  if (!desc || categoryComplements.length === 0) return [];

  // Sort flavor candidates by name length descending so "queijo coalho" matches before "queijo", and "carne de sol" before "carne"
  const sortedFlavorCandidates = [...flavorCandidates]
    .map(opt => ({ opt, normName: normalizeFlavorText(opt.name) }))
    .filter(x => x.normName.length >= 3)
    .sort((a, b) => b.normName.length - a.normName.length);

  const matchedFlavors: { opt: typeof flavorCandidates[number]; index: number }[] = [];
  let maskedDesc = desc;

  for (const { opt, normName } of sortedFlavorCandidates) {
    const escaped = normName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i');
    const match = regex.exec(maskedDesc);
    if (match) {
      const startIdx = match.index + (match[1] ? match[1].length : 0);
      matchedFlavors.push({ opt, index: startIdx });
      // Mask matched region with spaces so shorter substrings (e.g. "queijo" inside "queijo coalho") don't double-match
      maskedDesc =
        maskedDesc.slice(0, startIdx) +
        ' '.repeat(normName.length) +
        maskedDesc.slice(startIdx + normName.length);
    }
  }

  // Order flavors by appearance in the description
  // A recipe's generic "carne" refers to the catalog's ground beef,
  // even when that option is registered only as an additional.
  const groundBeef = categoryComplements.find(o => normalizeFlavorText(o.name) === 'carne moida');
  if (groundBeef && !matchedFlavors.some(({ opt }) => normalizeFlavorText(opt.name) === 'carne moida')) {
    const meatMatch = /(^|[^a-z0-9])carne(?:\s+moida)?(?![a-z0-9]|\s+(?:de|do|seca|desfiada|assada|suina|bovina)\b)/i.exec(maskedDesc);
    if (meatMatch) {
      const startIdx = meatMatch.index + meatMatch[1].length;
      const length = meatMatch[0].length - meatMatch[1].length;
      matchedFlavors.push({ opt: groundBeef, index: startIdx });
      maskedDesc = maskedDesc.slice(0, startIdx) + ' '.repeat(length) + maskedDesc.slice(startIdx + length);
    }
  }

  matchedFlavors.sort((a, b) => a.index - b.index);

  const result: SelectedComplement[] = [];
  for (const { opt } of matchedFlavors) {
    if (explicitProductMax != null && result.length >= explicitProductMax) break;
    result.push({
      name: opt.name,
      price: 0,
      quantity: 1,
      classification: 'flavor',
    });
  }

  // Also match free additionals (e.g. "orégano", "milho" if classified as free 'additional' instead of 'flavor')
  const freeAdditionalCandidates = categoryComplements
    .filter(
      o =>
        o.classification !== 'flavor' &&
        o.classification !== 'both' &&
        !(o.price > 0) &&
        !result.some(r => normalizeFlavorText(r.name) === normalizeFlavorText(o.name))
    )
    .map(opt => ({ opt, normName: normalizeFlavorText(opt.name) }))
    .filter(x => x.normName.length >= 3)
    .sort((a, b) => b.normName.length - a.normName.length);

  const matchedAdditionals: { opt: typeof categoryComplements[number]; index: number }[] = [];
  for (const { opt, normName } of freeAdditionalCandidates) {
    const escaped = normName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i');
    const match = regex.exec(maskedDesc);
    if (match) {
      const startIdx = match.index + (match[1] ? match[1].length : 0);
      matchedAdditionals.push({ opt, index: startIdx });
      maskedDesc =
        maskedDesc.slice(0, startIdx) +
        ' '.repeat(normName.length) +
        maskedDesc.slice(startIdx + normName.length);
    }
  }

  matchedAdditionals.sort((a, b) => a.index - b.index);
  for (const { opt } of matchedAdditionals) {
    result.push({
      name: opt.name,
      price: 0,
      quantity: 1,
      classification: 'additional',
    });
  }

  return result;
}

/** Tenants (slugs) where flavors/additionals are auto-preselected when launching an item. */
export const PRESELECT_FLAVOR_TENANTS: readonly string[] = ['pastelao-junin'];

export function tenantAllowsFlavorPreselect(slug: string | null | undefined): boolean {
  return !!slug && PRESELECT_FLAVOR_TENANTS.includes(slug.trim().toLowerCase());
}
