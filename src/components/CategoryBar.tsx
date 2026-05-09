import { ProductCategory } from '@/types';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface CategoryBarProps {
  categories: ProductCategory[];
  activeCategoryId: string;
  onSelect: (id: string) => void;
}

export function CategoryBar({ categories, activeCategoryId, onSelect }: CategoryBarProps) {
  const baseClass =
    'shrink-0 px-4 py-2.5 rounded-xl text-sm font-heading font-semibold tracking-wide transition-all whitespace-nowrap';
  const activeClass =
    'bg-primary/80 text-primary-foreground shadow-md ring-2 ring-primary-foreground/30';
  const inactiveClass =
    'bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground';

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-3 pb-2 px-1 snap-x snap-mandatory">
        <button
          onClick={() => onSelect('all')}
          className={cn(baseClass, 'snap-start', activeCategoryId === 'all' ? activeClass : inactiveClass)}
        >
          Todos
        </button>

        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={cn(baseClass, 'snap-start', activeCategoryId === cat.id ? activeClass : inactiveClass)}
          >
            {cat.name}
          </button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

