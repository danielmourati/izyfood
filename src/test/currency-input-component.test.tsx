import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { CurrencyInput } from '@/components/ui/currency-input';

function CurrencyInputHarness() {
  const [value, setValue] = useState('');
  return <CurrencyInput aria-label="Valor" value={value} onValueChange={setValue} />;
}

describe('CurrencyInput', () => {
  it('applies the BRL mask during real input events', () => {
    render(<CurrencyInputHarness />);
    const input = screen.getByRole('textbox', { name: 'Valor' });

    fireEvent.change(input, { target: { value: '3' } });
    expect(input).toHaveValue('R$ 0,03');

    fireEvent.change(input, { target: { value: '123456' } });
    expect(input).toHaveValue('R$ 1.234,56');
  });
});