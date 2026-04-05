import { ProductCategory } from '@/types';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface CategoryBarProps {
  categories: ProductCategory[];
  activeCategoryId: string;
  onSelect: (id: string) => void;
  productCounts: Record<string, number>;
}

const categoryIcons: Record<string, string> = {
  'Açaí': '🍇',
  'Sorvete': '🍦',
  'Bebidas': '🥤',
  'Lanches': '🍔',
  'Porções': '🍟',
  'Pizzas': '🍕',
  'Doces': '🍰',
  'Salgados': '🥟',
  'Sucos': '🧃',
  'Milkshake': '🥛',
  'Combos': '⭐',
  'Especiais': '✨',
};

function getIcon(name: string): string {
  for (const [key, icon] of Object.entries(categoryIcons)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return '🍽️';
}

export function CategoryBar({ categories, activeCategoryId, onSelect, productCounts }: CategoryBarProps) {
  const allCount = Object.values(productCounts).reduce((a, b) => a + b, 0);

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-3 pb-2 px-1">
        <button
          onClick={() => onSelect('all')}
          className={cn(
            'flex flex-col items-center gap-1.5 min-w-[72px] p-2 rounded-xl transition-all',
            activeCategoryId === 'all'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'bg-card hover:bg-secondary text-foreground'
          )}
        >
          <span className="text-2xl">🏷️</span>
          <span className="text-xs font-medium leading-tight">Todos</span>
          <span className={cn(
            'text-[10px] font-semibold px-1.5 rounded-full',
            activeCategoryId === 'all' ? 'bg-primary-foreground/20' : 'bg-muted'
          )}>
            {allCount}
          </span>
        </button>

        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={cn(
              'flex flex-col items-center gap-1.5 min-w-[72px] p-2 rounded-xl transition-all',
              activeCategoryId === cat.id
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-card hover:bg-secondary text-foreground'
            )}
          >
            <span className="text-2xl">{getIcon(cat.name)}</span>
            <span className="text-xs font-medium leading-tight text-center">{cat.name}</span>
            <span className={cn(
              'text-[10px] font-semibold px-1.5 rounded-full',
              activeCategoryId === cat.id ? 'bg-primary-foreground/20' : 'bg-muted'
            )}>
              {productCounts[cat.id] || 0}
            </span>
          </button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
