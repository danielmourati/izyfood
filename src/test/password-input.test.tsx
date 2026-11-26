import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PasswordInput } from '@/components/ui/password-input';

describe('Campo de senha com olhinho', () => {
  it('começa escondida e mostra a senha ao clicar no olhinho', () => {
    render(<PasswordInput aria-label="Senha mestra" defaultValue="segredo123" />);

    const field = screen.getByLabelText('Senha mestra');
    expect(field).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(field).toHaveAttribute('type', 'text');
    expect(field).toHaveValue('segredo123');

    fireEvent.click(screen.getByRole('button', { name: 'Esconder senha' }));
    expect(field).toHaveAttribute('type', 'password');
  });

  it('mantém o valor digitado ao alternar a visibilidade', () => {
    render(<PasswordInput aria-label="Confirmar senha" />);

    const field = screen.getByLabelText('Confirmar senha');
    fireEvent.change(field, { target: { value: 'abc123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));

    expect(screen.getByLabelText('Confirmar senha')).toHaveValue('abc123');
  });
});
