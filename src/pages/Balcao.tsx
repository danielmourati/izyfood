import { useMemo } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { useTenantNavigate } from '@/hooks/use-tenant-navigate';
import { usePrinter } from '@/hooks/use-printer';
import { ConsumerOrderModal } from '@/components/consumer/ConsumerOrderModal';
import { supabase } from '@/integrations/supabase/client';
import { Order } from '@/types';

/**
 * Balcão: abre um pedido rápido na mesma janela usada pelas Mesas.
 * O pedido é pago e finalizado na mesma sessão; ao fechar, volta para a Home.
 */
const Balcao = () => {
  const { setOrders } = useStore();
  const { printOrder, printBill } = usePrinter();
  const navigate = useTenantNavigate();

  const order = useMemo<Order>(() => ({
    id: crypto.randomUUID(),
    items: [],
    total: 0,
    orderType: 'balcao',
    status: 'aberto',
    createdAt: new Date().toISOString(),
  }), []);

  const removeOrder = async (orderId: string) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
    try { await supabase.from('orders').delete().eq('id', orderId); } catch {}
  };

  const handleSave = (updated: Order) => {
    if (!updated.items || updated.items.length === 0) {
      removeOrder(updated.id);
      return;
    }
    setOrders(prev => prev.some(o => o.id === updated.id)
      ? prev.map(o => (o.id === updated.id ? { ...updated, paymentSplits: updated.paymentSplits ?? o.paymentSplits } : o))
      : [updated, ...prev]);
  };

  return (
    <div className="h-full">
      <ConsumerOrderModal
        open
        onClose={() => navigate('/')}
        order={order}
        onSaveOrder={handleSave}
        onPrintOrder={async (o, intent = 'new') => {
          try { return await printOrder(o, { intent }); }
          catch (err: any) { return { ok: false, reason: err?.message || 'Erro ao imprimir comanda.' }; }
        }}
        onPrintBill={async (o) => { try { await printBill(o); } catch {} }}
        onDiscardEmptyOrder={(id) => removeOrder(id)}
        onDeleteOrder={(id) => removeOrder(id)}
      />
    </div>
  );
};

export default Balcao;
