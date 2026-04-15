import { supabase } from '@/integrations/supabase/client';

interface AuditLogParams {
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

export async function logAudit({ action, entityType, entityId, details }: AuditLogParams) {
  try {
    await supabase.rpc('log_audit_event', {
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId || null,
      p_details: details || {},
    });
  } catch (e) {
    console.error('Audit log error:', e);
  }
}
