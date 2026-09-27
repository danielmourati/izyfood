import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OrderItemDetails } from '@/components/OrderItemDetails';

describe('OrderItemDetails', () => {
  it('shows structured observations, free text, and complements without legacy duplicates', () => {
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
    expect(screen.getAllByText('Bem passado')).toHaveLength(1);
    expect(screen.getByText('Observações:')).toBeInTheDocument();
    expect(screen.getByText('Adicional:')).toBeInTheDocument();
    expect(screen.queryByText('Obs:')).not.toBeInTheDocument();
  });

  it('supports legacy pipe-separated observations', () => {
    render(<OrderItemDetails item={{ notes: 'Sem gelo | Limão à parte' }} />);
    expect(screen.getByText('Sem gelo')).toBeInTheDocument();
    expect(screen.getByText('Limão à parte')).toBeInTheDocument();
    expect(screen.getByText('Observações:')).toBeInTheDocument();
  });

  it('uses plural heading once for multiple complements', () => {
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
});