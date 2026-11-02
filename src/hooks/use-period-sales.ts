import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { readPeriodSales } from '@/lib/period-sales';

/** Range totals consume every page; identical ranges share React Query's flight. */
export function usePeriodSales(from: string, to: string, enabled = true) {
  const { user } = useAuth();
  const client = useQueryClient();
  const tenantId = user?.tenantId;
  const key = ['period-sales', user?.id, tenantId, from, to];
  const result = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => readPeriodSales(tenantId || '', from, to, signal),
    enabled: enabled && !!tenantId && !!from && !!to,
    refetchInterval: 60000,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    staleTime: 10000,
  });
  useEffect(() => {
    if (!tenantId || !enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const invalidate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void client.invalidateQueries({ queryKey: ['period-sales', user?.id, tenantId] }); }, 300);
    };
    const channel = supabase.channel(`period-sales-${tenantId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `tenant_id=eq.${tenantId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenantId}` }, invalidate)
      .subscribe(status => { if (status === 'SUBSCRIBED') invalidate(); });
    return () => { if (timer) clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [tenantId, user?.id, enabled, client]);
  return result;
}