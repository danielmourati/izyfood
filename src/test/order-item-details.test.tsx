import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OrderItemDetails } from '@/components/OrderItemDetails';

describe('OrderItemDetails', () => {
  it('separates flavors and additions with bold plural headings and no single quantity', () => {
    render(<OrderItemDetails item={{ selectedComplements: [
      { name: 'Carne', price: 0, quantity: 1, classification: 'flavor' },
      { name: 'Queijo', price: 0, quantity: 1, classification: 'flavor' },
      { name: 'Bacon', price: 2, quantity: 2, classification: 'additional' },
    ] }} />);
    expect(screen.getByText('Sabores:')).toHaveClass('font-semibold');
    expect(screen.getByText('Adicionais:')).toHaveClass('font-semibold');
    expect(screen.getByText('Carne')).toBeInTheDocument();
    expect(screen.getByText('Queijo')).toBeInTheDocument();
    expect(screen.getByText('2x Bacon')).toBeInTheDocument();
    expect(screen.queryByText(/1x /)).not.toBeInTheDocument();
  });
  it('shows structured observations, free text, and additional items without legacy duplicates', () => {
    render(
      <OrderItemDetails
        item={{
          notes: 'Bem passado | Sem cebola',
          selectedNotes: ['Bem passado'],
          otherNotes: 'Sem cebola',
          selectedComplements: [{ name: 'Arroz Integral', price: 3, quantity: 2 }],
        }}
      />,
    );

    expect(screen.getByText('Bem passado')).toBeInTheDocument();
    expect(screen.getByText('Sem cebola')).toBeInTheDocument();
    expect(screen.getByText(/2x Arroz Integral/)).toBeInTheDocument();
    expect(screen.getAllByText(/Bem passado/)).toHaveLength(1);
    expect(screen.getByText('Adicionais:')).toBeInTheDocument();
    expect(screen.queryByText('Observações:')).not.toBeInTheDocument();
  });

  it('supports legacy pipe-separated observations', () => {
    render(<OrderItemDetails item={{ notes: 'Sem gelo | Limão à parte' }} />);
    expect(screen.getByText('Sem gelo')).toBeInTheDocument();
    expect(screen.getByText('Limão à parte')).toBeInTheDocument();
    expect(screen.getByText('Adicionais:')).toBeInTheDocument();
  });

  it('uses plural heading once for multiple additional items', () => {
    render(
      <OrderItemDetails
        item={{
          selectedComplements: [
            { name: 'Arroz', price: 1, quantity: 1 },
            { name: 'Bacon', price: 3.5, quantity: 2 },
          ],
        }}
      />,
    );

    expect(screen.getAllByText('Adicionais:')).toHaveLength(1);
    expect(screen.getByText('Arroz')).toBeInTheDocument();
    expect(screen.getByText(/2x Bacon/)).toBeInTheDocument();
  });

  it('merges legacy observations with additional items under one title', () => {
    render(
      <OrderItemDetails
        item={{
          selectedNotes: ['Sem cebola'],
          selectedComplements: [
            { name: 'Todos os adicionais', price: 0, quantity: 1 },
            { name: 'Sem cebola', price: 0, quantity: 1 },
          ],
        }}
      />,
    );

    expect(screen.getAllByText('Adicionais:')).toHaveLength(1);
    expect(screen.getAllByText(/Sem cebola/)).toHaveLength(1);
    expect(screen.getByText(/Todos os adicionais/)).toBeInTheDocument();
  });
});