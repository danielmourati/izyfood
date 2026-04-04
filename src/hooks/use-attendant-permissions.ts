import { useState, useEffect, useRef } from 'react';
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
}

const allTrue: AttendantPermissions = {
  manage_categories: true,
  manage_products: true,
  edit_prices: true,
  manage_stock: true,
  remove_order_items: true,
  cancel_orders: true,
  apply_discounts: true,
  manage_customers: true,
};

const defaultPermissions: AttendantPermissions = {
  manage_categories: false,
  manage_products: false,
  edit_prices: false,
  manage_stock: false,
  remove_order_items: false,
  cancel_orders: false,
  apply_discounts: false,
  manage_customers: false,
};

function mapRow(data: any): AttendantPermissions {
  return {
    manage_categories: data.manage_categories,
    manage_products: data.manage_products,
    edit_prices: data.edit_prices,
    manage_stock: data.manage_stock,
    remove_order_items: data.remove_order_items,
    cancel_orders: data.cancel_orders,
    apply_discounts: data.apply_discounts,
    manage_customers: data.manage_customers,
  };
}

export function useAttendantPermissions() {
  const { user, isAdmin } = useAuth();
  const [permissions, setPermissions] = useState<AttendantPermissions>(defaultPermissions);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    // Clean up any previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

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

    // Initial fetch
    const fetchPermissions = async () => {
      const { data } = await supabase
        .from('attendant_permissions')
        .select('*')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      setPermissions(data ? mapRow(data) : defaultPermissions);
      setLoading(false);
    };

    fetchPermissions();

    // Realtime subscription with unique channel name
    const channelName = `perms-${user.id}-${Date.now()}`;
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
          if (payload.eventType === 'DELETE') {
            setPermissions(defaultPermissions);
          } else {
            setPermissions(mapRow(payload.new));
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user?.id, isAdmin]);

  return { permissions, loading };
}
