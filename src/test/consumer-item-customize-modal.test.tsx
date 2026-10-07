import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConsumerItemCustomizeModal } from '@/components/consumer/ConsumerItemCustomizeModal';
import type { Product } from '@/types';

vi.mock('@/contexts/StoreContext', () => ({
  useStore: () => ({
    noteOptions: [
      { id: '1', name: 'Sem gelo', type: 'note', price: 0, categoryIds: ['drinks'], active: true },
      { id: '2', name: 'Limão', type: 'complement', price: 1, categoryIds: ['drinks'], active: true },
      { id: '5', name: 'Todos os adicionais', type: 'complement', price: 0, categoryIds: ['drinks'], active: true },
      { id: '3', name: 'Sem cebola', type: 'note', price: 0, categoryIds: ['meals'], active: true },
      { id: '4', name: 'Inativo', type: 'note', price: 0, categoryIds: ['drinks'], active: false },
    ],
  }),
}));

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

    render(
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
      />,
    );

    expect(screen.getByText('Sem gelo')).toBeInTheDocument();
    expect(screen.getByText(/Limão/)).toBeInTheDocument();
    expect(screen.getByText('Todos os adicionais')).toBeInTheDocument();
    expect(screen.queryByText('Sem cebola')).not.toBeInTheDocument();
    expect(screen.queryByText('Inativo')).not.toBeInTheDocument();

    const additionalRow = screen.getByText(/Limão/).parentElement;
    const additionalButtons = additionalRow?.querySelectorAll('button');
    expect(additionalButtons).toHaveLength(2);
    fireEvent.click(additionalButtons?.[1] as HTMLButtonElement);
    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      selectedNotes: ['Sem gelo'],
      selectedComplements: [{ name: 'Limão', price: 1, quantity: 1 }],
    }));
  });

  it('treats Todos os adicionais as an independent regular option', () => {
    const onConfirm = vi.fn();
    render(
      <ConsumerItemCustomizeModal
        open
        onClose={() => undefined}
        product={product}
        onConfirm={onConfirm}
      />,
    );

    const allAdditionalRow = screen.getByText('Todos os adicionais').parentElement;
    const buttons = allAdditionalRow?.querySelectorAll('button');
    fireEvent.click(buttons?.[1] as HTMLButtonElement);
    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      selectedNotes: [],
      selectedComplements: [{ name: 'Todos os adicionais', price: 0, quantity: 1 }],
    }));
  });

  it('keeps Todos os adicionais at the top of the additions list', () => {
    render(
      <ConsumerItemCustomizeModal
        open
        onClose={() => undefined}
        product={product}
        onConfirm={vi.fn()}
      />,
    );

    const all = screen.getByText('Todos os adicionais');
    const lime = screen.getByText(/Limão/);
    expect(all.compareDocumentPosition(lime) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});