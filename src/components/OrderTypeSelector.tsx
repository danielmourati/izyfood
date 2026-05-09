import { OrderType } from '@/types';
import { cn } from '@/lib/utils';
import { Utensils, Store, Bike, ShoppingBag, LucideIcon } from 'lucide-react';

interface OrderTypeSelectorProps {
  value: OrderType;
  onChange: (type: OrderType) => void;
  className?: string;
  compact?: boolean;
}

const OPTIONS: { key: OrderType; label: string; icon: LucideIcon }[] = [
  { key: 'mesa', label: 'Mesa', icon: Utensils },
  { key: 'balcao', label: 'Balcão', icon: Store },
  { key: 'delivery', label: 'Delivery', icon: Bike },
  { key: 'retirada', label: 'Retirada', icon: ShoppingBag },
];

export function OrderTypeSelector({ value, onChange, className, compact }: OrderTypeSelectorProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 sm:grid-cols-4 gap-2',
        className,
      )}
    >
      {OPTIONS.map(({ key, label, icon: Icon }) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              'group flex flex-col items-center justify-center gap-1 rounded-xl border-2 transition-all select-none',
              compact ? 'py-2 px-1' : 'py-2.5 px-2',
              active
                ? 'bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]'
                : 'bg-card text-foreground border-border hover:border-accent hover:bg-accent/10',
            )}
            aria-pressed={active}
          >
            <Icon className={cn(compact ? 'h-4 w-4' : 'h-5 w-5')} strokeWidth={2.25} />
            <span
              className={cn(
                'font-heading font-semibold leading-none',
                compact ? 'text-[11px]' : 'text-xs',
              )}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
