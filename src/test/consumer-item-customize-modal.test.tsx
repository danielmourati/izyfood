import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConsumerItemCustomizeModal } from '@/components/consumer/ConsumerItemCustomizeModal';
import { StoreContext } from '@/contexts/StoreContext';
import type { Product } from '@/types';

const product: Product = {
  id: 'product-1',
  name: 'Coca-Cola Lata',
  price: 6,
  categoryId: 'drinks',
  type: 'unit',
  unit: 'un',
  stock: 10,
  loyaltyEligible: false,
  controlStock: false,
};

describe('ConsumerItemCustomizeModal', () => {
  it('shows only active options linked to the selected product category', () => {
    const onConfirm = vi.fn();
    const storeValue = {
      noteOptions: [
        { id: '1', name: 'Sem gelo', type: 'note', price: 0, categoryIds: ['drinks'], active: true },
        { id: '2', name: 'Limão', type: 'complement', price: 1, categoryIds: ['drinks'], active: true },
        { id: '3', name: 'Sem cebola', type: 'note', price: 0, categoryIds: ['meals'], active: true },
        { id: '4', name: 'Inativo', type: 'note', price: 0, categoryIds: ['drinks'], active: false },
      ],
    } as React.ContextType<typeof StoreContext>;

    render(
      <StoreContext.Provider value={storeValue}>
        <ConsumerItemCustomizeModal
          open
          onClose={() => undefined}
          product={product}
          itemToEdit={{
            id: 'item-1', productId: product.id, name: product.name, price: product.price,
            quantity: 1, subtotal: product.price, selectedNotes: ['Sem gelo'],
            selectedComplements: [], printed: false,
          }}
          onConfirm={onConfirm}
        />
      </StoreContext.Provider>,
    );

    expect(screen.getByText('Sem gelo')).toBeInTheDocument();
    expect(screen.getByText(/Limão/)).toBeInTheDocument();
    expect(screen.queryByText('Sem cebola')).not.toBeInTheDocument();
    expect(screen.queryByText('Inativo')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/Limão/).closest('div')?.querySelector('button') as HTMLButtonElement);
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      selectedNotes: ['Sem gelo'],
      selectedComplements: [{ name: 'Limão', price: 1, quantity: 1 }],
    }));
  });
});