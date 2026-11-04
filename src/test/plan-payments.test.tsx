import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlanosPage } from '@/pages/superadmin/PlanosPage';
import { resolvePaymentMethodLabel } from '@/lib/plan-pricing';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      const data = table === 'tenant_plans' ? [{
        id: 'plan-1', tenant_id: 'tenant-1', plan: 'pro_monthly', status: 'active',
        trial_ends_at: null, current_period_end: null, last_payment_at: null,
        tenants: { name: 'Loja teste', slug: 'loja-teste', active: true },
      }] : [{
        id: 'payment-1', amount: 157, status: 'approved', plan: 'pro_monthly',
        paid_at: '2026-11-03T12:00:00Z', created_at: '2026-11-03T12:00:00Z',
        mp_payment_id: '123456',
        raw: { payment_method: { id: 'pix', type: 'bank_transfer', issuer_id: '12501' }, notes: { unexpected: true } },
      }];
      const query = {
        select: () => query, eq: () => query, order: () => query, limit: () => query,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
      };
      return query;
    },
  },
}));

describe('plan payment data', () => {
  it.each([
    [{ id: 'pix', type: 'bank_transfer', issuer_id: '12501' }, 'PIX'],
    [{ id: 'visa', type: 'credit_card', issuer_id: '1' }, 'Cartão de Crédito'],
    ['cash', 'Dinheiro'],
    [{ issuer_id: '1' }, 'Mercado Pago'],
    [null, 'Mercado Pago'],
    ['constructor', 'constructor'],
    [{ type: 'constructor' }, 'constructor'],
    [[], 'Mercado Pago'],
  ])('normalizes provider payment method %j', (method, expected) => {
    expect(resolvePaymentMethodLabel(method)).toBe(expected);
  });

  it('opens billing history with provider object data without throwing', async () => {
    render(<TooltipProvider><PlanosPage /></TooltipProvider>);
    await screen.findByText('Loja teste');
    fireEvent.click(screen.getByRole('button', { name: 'Gerenciar Assinatura' }));
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Pagamentos & Cobranças/ }), { button: 0, ctrlKey: false });
    const paymentId = await screen.findByText('123456');
    const row = paymentId.closest('tr');
    if (!row) throw new Error('Payment row missing');
    expect(within(row).getByText('PIX')).toBeInTheDocument();
    expect(within(row).getByText('R$ 157,00')).toBeInTheDocument();
  });
});