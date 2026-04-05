import { TableInfo } from '@/types';
import { cn } from '@/lib/utils';

interface TableBarProps {
  tables: TableInfo[];
  onSelectTable: (table: TableInfo) => void;
}

export function TableBar({ tables, onSelectTable }: TableBarProps) {
  const occupiedTables = tables.filter(t => t.status === 'occupied');

  if (occupiedTables.length === 0) return null;

  return (
    <div className="border-t bg-card px-4 py-2">
      <div className="flex items-center gap-2 overflow-x-auto">
        <span className="text-xs font-medium text-muted-foreground shrink-0">Mesas:</span>
        {occupiedTables.map(t => (
          <button
            key={t.number}
            onClick={() => onSelectTable(t)}
            className={cn(
              'shrink-0 h-8 min-w-[40px] px-2 rounded-lg text-xs font-bold transition-colors',
              'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground'
            )}
          >
            T{t.number}
          </button>
        ))}
      </div>
    </div>
  );
}
