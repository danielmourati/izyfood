import type { OrderItem } from '@/types';
import { getOrderItemNoteLines } from '@/lib/utils';

interface OrderItemDetailsProps {
  item: Pick<OrderItem, 'notes' | 'selectedNotes' | 'otherNotes' | 'selectedComplements'>;
  compact?: boolean;
}

export function OrderItemDetails({ item, compact = false }: OrderItemDetailsProps) {
  const notes = getOrderItemNoteLines(item);
  const complements = item.selectedComplements || [];

  if (notes.length === 0 && complements.length === 0) return null;

  return (
    <div className={`${compact ? 'mt-0.5 text-[10px]' : 'mt-1 text-xs'} space-y-0.5 text-muted-foreground`}>
      {notes.map((note, index) => (
        <p key={`${note}-${index}`} className="leading-tight break-words">
          <span className="font-semibold text-foreground/80">Obs:</span> {note}
        </p>
      ))}
      {complements.map((complement, index) => (
        <p key={`${complement.name}-${index}`} className="leading-tight break-words">
          <span className="font-semibold text-foreground/80">Adicional:</span>{' '}
          {complement.quantity}x {complement.name}
        </p>
      ))}
    </div>
  );
}