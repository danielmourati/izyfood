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
    'shrink-0 px-4 py-2.5 rounded-xl text-sm font-heading font-semibold tracking-wide transition-all whitespace-nowrap text-primary-foreground';

  const getColor = (index: number) => {
    const colors = [
      'bg-[#2E7D32]', // Verde escuro
      'bg-[#D84315]', // Laranja escuro
      'bg-[#1565C0]', // Azul
      'bg-[#6A1B9A]', // Roxo
      'bg-[#C62828]', // Vermelho
      'bg-[#00838F]', // Ciano escuro
      'bg-[#EF6C00]', // Laranja
      'bg-[#4527A0]', // Roxo escuro
      'bg-[#0277BD]', // Azul claro
      'bg-[#AD1457]', // Rosa escuro
    ];
    return colors[index % colors.length];
  };

  const getActiveState = (isActive: boolean) => 
    isActive 
      ? 'opacity-100 shadow-md ring-2 ring-offset-2 ring-slate-400 scale-[1.02]' 
      : 'opacity-85 hover:opacity-100';

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-3 pb-2 px-1 snap-x snap-mandatory">
        <button
          onClick={() => onSelect('all')}
          className={cn(baseClass, getColor(0), getActiveState(activeCategoryId === 'all'), 'snap-start')}
        >
          Todos
        </button>

        {categories.map((cat, index) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={cn(baseClass, getColor(index + 1), getActiveState(activeCategoryId === cat.id), 'snap-start')}
          >
            {cat.name}
          </button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

