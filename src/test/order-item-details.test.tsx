import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OrderItemDetails } from '@/components/OrderItemDetails';

describe('OrderItemDetails', () => {
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

    expect(screen.getByText(/1x Bem passado/)).toBeInTheDocument();
    expect(screen.getByText(/1x Sem cebola/)).toBeInTheDocument();
    expect(screen.getByText(/2x Arroz Integral/)).toBeInTheDocument();
    expect(screen.getAllByText(/Bem passado/)).toHaveLength(1);
    expect(screen.getByText('Adicionais:')).toBeInTheDocument();
    expect(screen.queryByText('Observações:')).not.toBeInTheDocument();
  });

  it('supports legacy pipe-separated observations', () => {
    render(<OrderItemDetails item={{ notes: 'Sem gelo | Limão à parte' }} />);
    expect(screen.getByText(/1x Sem gelo/)).toBeInTheDocument();
    expect(screen.getByText(/1x Limão à parte/)).toBeInTheDocument();
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
    expect(screen.getByText(/1x Arroz/)).toBeInTheDocument();
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