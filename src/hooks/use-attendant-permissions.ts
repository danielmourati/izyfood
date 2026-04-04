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
}

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

    // Admins/superadmins have all permissions
    if (isAdmin) {
      setPermissions({
        manage_categories: true,
        manage_products: true,
        edit_prices: true,
        manage_stock: true,
        remove_order_items: true,
        cancel_orders: true,
        apply_discounts: true,
        manage_customers: true,
      });
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      const { data } = await supabase
        .from('attendant_permissions')
        .select('*')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (data) {
        setPermissions({
          manage_categories: data.manage_categories,
          manage_products: data.manage_products,
          edit_prices: data.edit_prices,
          manage_stock: data.manage_stock,
          remove_order_items: data.remove_order_items,
          cancel_orders: data.cancel_orders,
          apply_discounts: data.apply_discounts,
          manage_customers: data.manage_customers,
        });
      } else {
        setPermissions(defaultPermissions);
      }
      setLoading(false);
    };

    fetchPermissions();
  }, [user, isAdmin]);

  return { permissions, loading };
}
