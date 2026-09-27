import type { Product, ProductCategory } from '@/types';

export const PRINT_SECTOR_OPTIONS: { key: string; label: string }[] = [
  { key: 'cozinha', label: 'Cozinha' },
  { key: 'bar', label: 'Bar' },
  { key: 'balcao', label: 'Balcão' },
  { key: 'recibo', label: 'Recibo (Caixa)' },
  { key: 'none', label: 'Não imprimir' },
];

export const sectorLabel = (key?: string | null) =>
  PRINT_SECTOR_OPTIONS.find(o => o.key === key)?.label || (key ? key.toUpperCase() : 'Cozinha');

/**
 * Monta as opções do campo "Imprimir em" a partir das impressoras
 * ativas em Configurações > Impressora (printer_configs).
 * Cada setor com impressora vinculada vira uma opção, com o nome da
 * impressora entre parênteses. Setores customizados também entram.
 */
export function buildSectorOptions(
  printers: { sector?: string | null; name?: string | null }[],
): { key: string; label: string }[] {
  const bySector = new Map<string, string>();
  for (const p of printers) {
    const sec = p.sector?.trim();
    if (!sec || bySector.has(sec)) continue;
    bySector.set(sec, p.name?.trim() || '');
  }
  return [...bySector.entries()].map(([key, printerName]) => ({
    key,
    label: printerName ? `${sectorLabel(key)} (${printerName})` : sectorLabel(key),
  }));
}

/** Setor de impressão de um item: produto > categoria > cozinha. */
export function resolveItemSector(
  item: { productId?: string },
  products: Product[],
  categories: ProductCategory[],
): string {
  const product = products.find(p => p.id === item.productId);
  if (product?.printSector) return product.printSector;
  const cat = product ? categories.find(c => c.id === product.categoryId) : undefined;
  return cat?.printSector || 'cozinha';
}
