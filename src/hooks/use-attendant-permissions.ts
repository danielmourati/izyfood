import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AttendantPermissions {
  manage_categories: boolean;
  manage_products: boolean;
  edit_prices: boolean;
  manage_stock: boolean;
  remove_order_items: boolean;
  cancel_orders: boolean;
  apply_discounts: boolean;
  manage_customers: boolean;
  manage_cash: boolean;
  // Cash register controls
  open_cash_register: boolean;
  close_cash_register: boolean;
  view_cash_register: boolean;
  // Reports & orders history
  view_reports: boolean;
  view_orders_history: boolean;
  // Salon & delivery ops
  manage_deliveries: boolean;
  manage_tables: boolean;
  // Auxiliary registrations
  manage_coupons: boolean;
  manage_suppliers: boolean;
  manage_printers: boolean;
}

export const PERMISSION_KEYS: (keyof AttendantPermissions)[] = [
  'manage_categories','manage_products','edit_prices','manage_stock',
  'remove_order_items','cancel_orders','apply_discounts','manage_customers',
  'manage_cash','open_cash_register','close_cash_register','view_cash_register',
  'view_reports','view_orders_history','manage_deliveries','manage_tables',
  'manage_coupons','manage_suppliers','manage_printers',
];

function buildDefaults(value: boolean): AttendantPermissions {
  return PERMISSION_KEYS.reduce((acc, k) => {
    acc[k] = value;
    return acc;
  }, {} as AttendantPermissions);
}

const allTrue: AttendantPermissions = buildDefaults(true);
const defaultPermissions: AttendantPermissions = buildDefaults(false);

function mapRow(data: any): AttendantPermissions {
  const out = { ...defaultPermissions };
  for (const k of PERMISSION_KEYS) {
    out[k] = Boolean(data?.[k]);
  }
  return out;
}

export function useAttendantPermissions() {
  const { user, isAdmin } = useAuth();
  const [permissions, setPermissions] = useState<AttendantPermissions>(defaultPermissions);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPermissions(defaultPermissions);
      setLoading(false);
      return;
    }

    if (isAdmin) {
      setPermissions(allTrue);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchPermissions = async () => {
      const { data } = await supabase
        .from('attendant_permissions')
        .select('*')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (!cancelled) {
        setPermissions(data ? mapRow(data) : defaultPermissions);
        setLoading(false);
      }
    };

    fetchPermissions();

    const channelName = `perms-${user.id}-${Date.now()}-${Math.random()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendant_permissions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (cancelled) return;
          if (payload.eventType === 'DELETE') {
            setPermissions(defaultPermissions);
          } else {
            setPermissions(mapRow(payload.new));
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id, isAdmin]);

  return { permissions, loading };
}
