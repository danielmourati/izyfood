import type { OrderItem } from '@/types';
import { getOrderItemAdditionalLines } from '@/lib/utils';

interface OrderItemDetailsProps {
  item: Pick<OrderItem, 'notes' | 'selectedNotes' | 'otherNotes' | 'selectedComplements'>;
  compact?: boolean;
}

export function OrderItemDetails({ item, compact = false }: OrderItemDetailsProps) {
  const additionalItems = getOrderItemAdditionalLines(item);

  if (additionalItems.length === 0) return null;

  return (
    <div className={`${compact ? 'mt-0.5 text-[10px]' : 'mt-1 text-xs'} space-y-0.5 text-muted-foreground`}>
      <div className="leading-tight break-words">
        <span className="font-semibold text-foreground/80">
          {additionalItems.length === 1 ? 'Adicional:' : 'Adicionais:'}
        </span>{' '}
        {additionalItems.length === 1 ? (
          <>{additionalItems[0].quantity}x {additionalItems[0].name}</>
        ) : (
          <span className="block pl-2">
            {additionalItems.map((additional, index) => (
              <span key={`${additional.name}-${index}`} className="block">
                <span aria-hidden="true">• </span>
                <span>{additional.quantity}x {additional.name}</span>
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}