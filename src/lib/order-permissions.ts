import { supabase } from '@/integrations/supabase/client';

/** Item já impresso só pode ser removido por admin ou atendente com permissão liberada. */
export function needsAuthToRemoveItem(item: { printed?: boolean }, canRemovePrinted: boolean): boolean {
  return !!item.printed && !canRemovePrinted;
}

/** Lixeira só aparece quando o usuário pode remover o item sem precisar de senha de admin. */
export function showsRemoveItemControl(item: { printed?: boolean }, canRemovePrinted: boolean): boolean {
  return !needsAuthToRemoveItem(item, canRemovePrinted);
}

/** Valida no servidor a senha de qualquer admin da loja do usuário atual. */
export async function verifyTenantAdminPassword(password: string): Promise<{ ok: boolean; adminName?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('verify-admin-password', { body: { password } });
    if (error || !data?.success) return { ok: false };
    return { ok: true, adminName: data.admin_name };
  } catch {
    return { ok: false };
  }
}
