import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { dbToOrder } from '@/contexts/StoreContext';
import { supabase } from '@/integrations/supabase/client';
import { brazilDayBounds } from '@/lib/query-pages';

export const ORDER_HISTORY_PAGE_SIZE = 50;

export function useOrderHistory(start: string, end: string, status: string, page: number) {
  const { user } = useAuth();
  const client = useQueryClient();
  const tenantId = user?.tenantId;
  const result = useQuery({
    queryKey: ['order-history', user?.id, tenantId, start, end, status, page],
    enabled: !!tenantId && !!start && !!end && start <= end,
    queryFn: async ({ signal }) => {
      let query = supabase.from('orders').select('*', { count: 'exact' }).eq('tenant_id', tenantId || '')
        .gte('created_at', brazilDayBounds(start).from).lte('created_at', brazilDayBounds(end).to)
        .order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(page * ORDER_HISTORY_PAGE_SIZE, (page + 1) * ORDER_HISTORY_PAGE_SIZE - 1).abortSignal(signal);
      if (status !== 'all') query = query.eq('status', status as 'aberto');
      const { data, error, count } = await query;
      if (error || !data) throw error || new Error('Não foi possível carregar o histórico.');
      return { orders: data.map(dbToOrder), count: count || 0 };
    },
    refetchInterval: 60000,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
  useEffect(() => {
    if (!tenantId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const invalidate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void client.invalidateQueries({ queryKey: ['order-history', user?.id, tenantId] }); }, 300);
    };
    const channel = supabase.channel(`order-history-${tenantId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenantId}` }, invalidate)
      .subscribe(status => { if (status === 'SUBSCRIBED') invalidate(); });
    return () => { if (timer) clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [tenantId, user?.id, client]);
  return result;
}