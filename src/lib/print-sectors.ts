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
