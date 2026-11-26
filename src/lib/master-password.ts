import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/lib/audit';
import { verifyTenantAdminPassword } from '@/lib/order-permissions';

const LS_MASTER_HASH_PREFIX = 'izy_master_pwd_hash_';
const LS_PRINT_SETTINGS_PREFIX = 'print_settings_';

/**
 * Motivo gravado na auditoria quando a exclusão acontece sem modal de Senha Mestra,
 * porque a Senha Mestra ainda não foi configurada na loja.
 */
export const MASTER_PASSWORD_NOT_CONFIGURED_REASON = 'Senha Mestra não configurada';

/**
 * Pure deterministic SHA-256 hex digest using Web Crypto API (with fallback).
 */
export async function hashMasterPassword(tenantId: string, password: string): Promise<string> {
  const cleanTenant = (tenantId || 'default').trim();
  const cleanPwd = password.trim();
  const payload = `izyfood::master::${cleanTenant}::${cleanPwd}`;

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback deterministic FNV-1a 256-bit style hex if subtle crypto is unavailable
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + i;
    h2 = Math.imul(h2, 0x811c9dc5);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

function getLocalMasterHash(tenantId: string): string | null {
  try {
    const direct = localStorage.getItem(`${LS_MASTER_HASH_PREFIX}${tenantId}`);
    if (direct && direct.trim()) return direct.trim();

    const psRaw = localStorage.getItem(`${LS_PRINT_SETTINGS_PREFIX}${tenantId}`);
    if (psRaw) {
      const ps = JSON.parse(psRaw);
      if (ps?.master_password_hash && typeof ps.master_password_hash === 'string') {
        return ps.master_password_hash.trim();
      }
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function saveLocalMasterHash(tenantId: string, hash: string) {
  try {
    localStorage.setItem(`${LS_MASTER_HASH_PREFIX}${tenantId}`, hash);
    const psKey = `${LS_PRINT_SETTINGS_PREFIX}${tenantId}`;
    const existingRaw = localStorage.getItem(psKey);
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    existing.master_password_hash = hash;
    existing.master_password_updated_at = new Date().toISOString();
    localStorage.setItem(psKey, JSON.stringify(existing));
  } catch {
    // ignore storage errors
  }
}

/**
 * Retrieves the tenant's configured master password hash from Supabase store_settings
 * (with localStorage cache fallback).
 */
export async function getTenantMasterPasswordHash(tenantId?: string | null): Promise<string | null> {
  if (!tenantId) return null;

  try {
    const { data, error } = await supabase
      .from('store_settings')
      .select('print_settings')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();

    if (!error && data?.print_settings && typeof data.print_settings === 'object') {
      const ps = data.print_settings as Record<string, unknown>;
      const dbHash = typeof ps.master_password_hash === 'string' ? ps.master_password_hash.trim() : '';
      if (dbHash) {
        saveLocalMasterHash(tenantId, dbHash);
        return dbHash;
      }
    }
  } catch {
    // Fall back to local cache
  }

  return getLocalMasterHash(tenantId);
}

export async function hasTenantMasterPassword(tenantId?: string | null): Promise<boolean> {
  const hash = await getTenantMasterPasswordHash(tenantId);
  return Boolean(hash);
}

/**
 * Checks if a candidate password matches any admin's login password for this tenant.
 */
export async function isSameAsAdminLoginPassword(candidatePassword: string): Promise<boolean> {
  const clean = candidatePassword.trim();
  if (!clean) return false;

  // 1. Check via verify-admin-password edge function (checks all tenant admins)
  try {
    const res = await verifyTenantAdminPassword(clean);
    if (res.ok) return true;
  } catch {
    // ignore and check fallback
  }

  return false;
}

/**
 * Sets or updates the tenant's Master Password, ensuring it is NEVER the same as the Admin's login password.
 */
export async function setTenantMasterPassword(params: {
  tenantId: string;
  newPassword: string;
  currentMasterPassword?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { tenantId, newPassword, currentMasterPassword } = params;
  const cleanNew = (newPassword || '').trim();

  if (!tenantId) {
    return { ok: false, error: 'Estabelecimento não identificado.' };
  }
  if (cleanNew.length < 4) {
    return { ok: false, error: 'A Senha Mestra deve ter pelo menos 4 caracteres.' };
  }

  // If a master password already exists and currentMasterPassword was required/provided
  const existingHash = await getTenantMasterPasswordHash(tenantId);
  if (existingHash && currentMasterPassword !== undefined) {
    const cleanCurrent = currentMasterPassword.trim();
    if (!cleanCurrent) {
      return { ok: false, error: 'Informe a Senha Mestra atual para alterá-la.' };
    }
    const currentHash = await hashMasterPassword(tenantId, cleanCurrent);
    if (currentHash !== existingHash) {
      return { ok: false, error: 'A Senha Mestra atual informada está incorreta.' };
    }
  }

  // Block if candidate password is the same as the Admin's login password
  const matchesAdminLogin = await isSameAsAdminLoginPassword(cleanNew);
  if (matchesAdminLogin) {
    return {
      ok: false,
      error: 'A Senha Mestra não pode ser igual à senha de login do administrador. Defina uma senha exclusiva.',
    };
  }

  const newHash = await hashMasterPassword(tenantId, cleanNew);
  const nowIso = new Date().toISOString();

  // Persist in store_settings.print_settings
  try {
    const { data: existingRow } = await supabase
      .from('store_settings')
      .select('id, print_settings')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();

    if (existingRow) {
      const currentPs =
        existingRow.print_settings && typeof existingRow.print_settings === 'object'
          ? { ...(existingRow.print_settings as Record<string, unknown>) }
          : {};
      currentPs.master_password_hash = newHash;
      currentPs.master_password_updated_at = nowIso;

      const { error: updErr } = await supabase
        .from('store_settings')
        .update({ print_settings: currentPs as any })
        .eq('id', existingRow.id);

      if (updErr) throw updErr;
    } else {
      const { error: insErr } = await supabase.from('store_settings').insert({
        tenant_id: tenantId,
        table_count: 20,
        service_fee_percentage: 0,
        print_settings: {
          master_password_hash: newHash,
          master_password_updated_at: nowIso,
        } as any,
      });
      if (insErr) throw insErr;
    }
  } catch (err: any) {
    console.error('[master-password] erro ao salvar no banco:', err);
    return { ok: false, error: err?.message || 'Não foi possível salvar a Senha Mestra no banco de dados.' };
  }

  saveLocalMasterHash(tenantId, newHash);

  await logAudit({
    action: 'master_password_updated',
    entityType: 'settings',
    entityId: tenantId,
    details: {
      atualizado_em: nowIso,
      ja_possuia_senha_mestra: Boolean(existingHash),
    },
  });

  return { ok: true };
}

/**
 * Verifies the tenant's Master Password for deletion of saved items, orders, or payments.
 * Rejects the admin's login password and logs failed attempts in audit_logs.
 */
export async function verifyTenantMasterPassword(params: {
  tenantId?: string | null;
  password: string;
  target?: 'item' | 'order' | 'payment';
  entityId?: string;
  details?: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string }> {
  const { tenantId, password, target = 'order', entityId, details } = params;
  const cleanPwd = (password || '').trim();

  if (!cleanPwd) {
    return { ok: false, error: 'Informe a Senha Mestra para confirmar a exclusão.' };
  }
  if (!tenantId) {
    return { ok: false, error: 'Estabelecimento não identificado.' };
  }

  const storedHash = await getTenantMasterPasswordHash(tenantId);
  if (!storedHash) {
    return {
      ok: false,
      error: 'A Senha Mestra ainda não foi configurada nesta loja. Acesse Configurações > Geral para cadastrá-la.',
    };
  }

  const candidateHash = await hashMasterPassword(tenantId, cleanPwd);
  if (candidateHash !== storedHash) {
    await logAudit({
      action: 'master_password_failed',
      entityType: 'security',
      entityId: entityId,
      details: {
        alvo: target,
        motivo_falha: 'Senha Mestra incorreta',
        ...details,
      },
    });
    return {
      ok: false,
      error: 'Senha Mestra incorreta. (Lembre-se: a Senha Mestra é exclusiva e diferente da senha de login do admin).',
    };
  }

  return { ok: true };
}
