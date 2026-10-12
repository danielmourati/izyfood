import type { OrderItem } from '@/types';
import { getOrderItemCustomizationGroups, formatCustomizationLine } from '@/lib/utils';

interface OrderItemDetailsProps {
  item: Pick<OrderItem, 'notes' | 'selectedNotes' | 'otherNotes' | 'selectedComplements'>;
  compact?: boolean;
}

export function OrderItemDetails({ item, compact = false }: OrderItemDetailsProps) {
  const groups = getOrderItemCustomizationGroups(item);

  if (groups.length === 0) return null;

  return (
    <div className={`${compact ? 'mt-0.5 text-[10px]' : 'mt-1 text-xs'} space-y-0.5 text-muted-foreground`}>
      {groups.map(group => <div key={group.title} className="leading-tight break-words">
        <span className="font-semibold text-foreground/80">
          {group.title}
        </span>{' '}
          <span className="block pl-2">
            {group.items.map((additional, index) => (
              <span key={`${additional.name}-${index}`} className="block">
                <span aria-hidden="true">• </span>
                <span>{formatCustomizationLine(additional)}</span>
              </span>
            ))}
          </span>
      </div>)}
    </div>
  );
}