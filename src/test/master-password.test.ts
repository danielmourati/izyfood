import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hashMasterPassword,
  setTenantMasterPassword,
  verifyTenantMasterPassword,
} from '@/lib/master-password';
import * as orderPermissions from '@/lib/order-permissions';
import * as auditModule from '@/lib/audit';

vi.mock('@/integrations/supabase/client', () => {
  const mockStoreSettings: Record<string, any> = {};
  return {
    supabase: {
      from: (table: string) => {
        if (table === 'store_settings') {
          return {
            select: () => ({
              eq: (_col: string, tenantId: string) => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: mockStoreSettings[tenantId] || null,
                    error: null,
                  }),
                }),
              }),
            }),
            update: (patch: any) => ({
              eq: async (_col: string, id: string) => {
                const entry = Object.values(mockStoreSettings).find((r: any) => r.id === id);
                if (entry) Object.assign(entry, patch);
                return { error: null };
              },
            }),
            insert: async (row: any) => {
              mockStoreSettings[row.tenant_id] = { id: `st-${row.tenant_id}`, ...row };
              return { error: null };
            },
          };
        }
        return {};
      },
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  };
});

describe('Master Password (Senha Mestra de Exclusão)', () => {
  const tenantId = 'tenant-test-123';

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('produces deterministic SHA-256 hashes scoped by tenantId', async () => {
    const h1 = await hashMasterPassword('tenant-a', '9988');
    const h2 = await hashMasterPassword('tenant-a', '9988');
    const hOtherTenant = await hashMasterPassword('tenant-b', '9988');
    expect(h1).toBe(h2);
    expect(h1).not.toBe(hOtherTenant);
  });

  it('rejects setting a Master Password identical to the Admin login password', async () => {
    vi.spyOn(orderPermissions, 'verifyTenantAdminPassword').mockResolvedValue({
      ok: true,
      adminName: 'Admin Loja',
    });

    const res = await setTenantMasterPassword({
      tenantId,
      newPassword: 'adminLoginPass123',
    });

    expect(res.ok).toBe(false);
    expect(res.error).toContain('não pode ser igual à senha de login do administrador');
  });

  it('saves a distinct Master Password, verifies it, and logs failed attempts', async () => {
    vi.spyOn(orderPermissions, 'verifyTenantAdminPassword').mockResolvedValue({ ok: false });
    const auditSpy = vi.spyOn(auditModule, 'logAudit').mockResolvedValue();

    const saveRes = await setTenantMasterPassword({
      tenantId,
      newPassword: 'Mestra@2026',
    });
    expect(saveRes.ok).toBe(true);
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'master_password_updated',
        entityType: 'settings',
        entityId: tenantId,
      })
    );

    // Wrong password -> fails and logs master_password_failed
    const failRes = await verifyTenantMasterPassword({
      tenantId,
      password: 'WrongPassword',
      target: 'payment',
      entityId: 'order-1',
    });
    expect(failRes.ok).toBe(false);
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'master_password_failed',
        entityType: 'security',
        entityId: 'order-1',
      })
    );

    // Correct Master Password -> succeeds
    const okRes = await verifyTenantMasterPassword({
      tenantId,
      password: 'Mestra@2026',
      target: 'payment',
      entityId: 'order-1',
    });
    expect(okRes.ok).toBe(true);
  });
});
