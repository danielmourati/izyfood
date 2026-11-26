import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MasterPasswordConfirmModal } from '@/components/MasterPasswordConfirmModal';
import { MASTER_PASSWORD_NOT_CONFIGURED_REASON } from '@/lib/master-password';

const TENANT_ID = 'tenant-modal-1';
const PASSWORD_PLACEHOLDER = 'Digite a Senha Mestra (não é a senha de login)...';

/** store_settings.print_settings.master_password_hash da loja sob teste. */
const db = vi.hoisted(() => ({ masterHash: null as string | null }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      name: 'Ana',
      email: 'ana@loja.com',
      tenantId: TENANT_ID,
      role: 'admin',
      slug: 'loja-teste',
    },
    isAdmin: true,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'store_settings') {
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: async () => ({
                  data: db.masterHash
                    ? { id: 'st-1', tenant_id: TENANT_ID, print_settings: { master_password_hash: db.masterHash } }
                    : null,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

function renderModal(onAuthorized: ReturnType<typeof vi.fn>, onClose: ReturnType<typeof vi.fn>) {
  return render(
    <MasterPasswordConfirmModal
      open
      onClose={onClose}
      title="Confirmar Exclusão de Item"
      description="Informe a Senha Mestra do estabelecimento para autorizar a exclusão deste item."
      summaryText="1x Pizza Pequena (P) - Calabresa — R$ 25,00"
      target="item"
      entityId="order-1"
      confirmButtonLabel="Confirmar Exclusão do Item"
      onAuthorized={onAuthorized}
    />,
  );
}

describe('Modal de Senha Mestra só aparece quando configurada', () => {
  beforeEach(() => {
    localStorage.clear();
    db.masterHash = null;
    vi.clearAllMocks();
  });

  it('autoriza direto, sem mostrar o modal, quando a Senha Mestra não está configurada', async () => {
    const onAuthorized = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    renderModal(onAuthorized, onClose);

    await waitFor(() =>
      expect(onAuthorized).toHaveBeenCalledWith({ reason: MASTER_PASSWORD_NOT_CONFIGURED_REASON }),
    );
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByPlaceholderText(PASSWORD_PLACEHOLDER)).toBeNull();
    expect(screen.queryByText('Senha Mestra de Exclusão *')).toBeNull();
  });

  it('mostra o modal pedindo a Senha Mestra quando ela já está configurada', async () => {
    db.masterHash = 'hash-configurada';
    const onAuthorized = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    renderModal(onAuthorized, onClose);

    await screen.findByPlaceholderText(PASSWORD_PLACEHOLDER);
    expect(onAuthorized).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
