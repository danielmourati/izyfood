import { ProductCategory } from '@/types';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface CategoryBarProps {
  categories: ProductCategory[];
  activeCategoryId: string;
  onSelect: (id: string) => void;
}

export function CategoryBar({ categories, activeCategoryId, onSelect }: CategoryBarProps) {
  return (
    <ScrollArea className="w-full">
      <div className="flex gap-3 pb-2 px-1">
        <button
          onClick={() => onSelect('all')}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-medium transition-all',
            activeCategoryId === 'all'
              ? 'bg-primary/80 text-primary-foreground shadow-md ring-2 ring-primary-foreground/30'
              : 'bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          Todos
        </button>

        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
              activeCategoryId === cat.id
                ? 'bg-primary/80 text-primary-foreground shadow-md ring-2 ring-primary-foreground/30'
                : 'bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
