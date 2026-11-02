import { supabase } from '@/integrations/supabase/client';
import { collectPages } from '@/lib/query-pages';
import type { Sale } from '@/types';

export interface SaleOrderInfo { id: string; openedBy?: string; openedByName?: string; orderType: string; serviceFee: number }
export interface PeriodSales { sales: Sale[]; orders: SaleOrderInfo[] }

export async function readPeriodSales(tenantId: string, from: string, to: string, signal?: AbortSignal): Promise<PeriodSales> {
  if (!tenantId || !from || !to || from > to) throw new Error('Informe um período válido.');
  const rows = await collectPages<any>((offset, size) => {
    let query = supabase.from('sales').select('id,order_id,total,payment_method,customer_id,date,items,payment_splits')
      .eq('tenant_id', tenantId).gte('date', from).lte('date', to)
      .order('date', { ascending: false }).order('id', { ascending: false }).range(offset, offset + size - 1);
    if (signal) query = query.abortSignal(signal);
    return query;
  });
  const ids = [...new Set<string>(rows.map(r => r.order_id).filter(Boolean))];
  const orders: SaleOrderInfo[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    let query = supabase.from('orders').select('id,opened_by,opened_by_name,order_type,service_fee')
      .eq('tenant_id', tenantId).in('id', ids.slice(i, i + 100));
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error || !data) throw error || new Error('Não foi possível conferir os pedidos das vendas.');
    orders.push(...data.map(r => ({ id: r.id, openedBy: r.opened_by || undefined, openedByName: r.opened_by_name || undefined, orderType: r.order_type, serviceFee: Number(r.service_fee || 0) })));
  }
  return { sales: rows.map(r => ({ id: r.id, orderId: r.order_id, total: Number(r.total), paymentMethod: r.payment_method, customerId: r.customer_id || undefined, date: r.date, items: r.items, paymentSplits: r.payment_splits || undefined })), orders };
}