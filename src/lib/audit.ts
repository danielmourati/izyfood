import { supabase } from '@/integrations/supabase/client';

interface AuditLogParams {
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

export async function logAudit({ userId, userName, action, entityType, entityId, details }: AuditLogParams) {
  try {
    await supabase.from('audit_logs').insert({
      user_id: userId,
      user_name: userName,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      details: details || {},
    } as any);
  } catch (e) {
    console.error('Audit log error:', e);
  }
}
