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
      {notes.length > 0 && (
        <div className="leading-tight break-words">
          <span className="font-semibold text-foreground/80">
            {notes.length === 1 ? 'Obs:' : 'Observações:'}
          </span>{' '}
          {notes.length === 1 ? (
            notes[0]
          ) : (
            <span className="block pl-2">
              {notes.map((note, index) => (
                <span key={`${note}-${index}`} className="block">
                  <span aria-hidden="true">• </span><span>{note}</span>
                </span>
              ))}
            </span>
          )}
        </div>
      )}
      {complements.length > 0 && (
        <div className="leading-tight break-words">
          <span className="font-semibold text-foreground/80">
            {complements.length === 1 ? 'Adicional:' : 'Adicionais:'}
          </span>{' '}
          {complements.length === 1 ? (
            <>{complements[0].quantity}x {complements[0].name}</>
          ) : (
            <span className="block pl-2">
              {complements.map((complement, index) => (
                <span key={`${complement.name}-${index}`} className="block">
                  <span aria-hidden="true">• </span>
                  <span>{complement.quantity}x {complement.name}</span>
                </span>
              ))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}