import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantNavigate } from '@/hooks/use-tenant-navigate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRightLeft, Merge, Lock, Utensils, Store, Bike, ShoppingBag, Menu, Search } from 'lucide-react';
import { toast } from 'sonner';
import { fmt, getOrderAttendantName } from '@/lib/utils';
import { differenceInMinutes } from 'date-fns';
import { ConsumerOrderModal } from '@/components/consumer/ConsumerOrderModal';
import { usePrinter } from '@/hooks/use-printer';
import { Order } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { dbToOrder } from '@/contexts/StoreContext';
import { pickTableOrder, canDeleteOrder, allowOrderDelete } from '@/lib/order-merge';

const Mesas = () => {
  const { tables, setTables, orders, setOrders, customers, freeTable, moveOrderTable, lastSyncError } = useStore();
  const { user } = useAuth();
  const { printOrder, printBill } = usePrinter();
  const navigate = useTenantNavigate();
  const [transferModal, setTransferModal] = useState<{ open: boolean; fromTable: number | null }>({ open: false, fromTable: null });
  const [mergeModal, setMergeModal] = useState<{ open: boolean; sourceTable: number | null }>({ open: false, sourceTable: null });
  const [consumerOrderModal, setConsumerOrderModal] = useState<{ open: boolean; order: Order | null; tableNumber?: number }>({ open: false, order: null });

  const [searchQuery, setSearchQuery] = useState('');

  const isQuintalDeCasa = user?.tenantSlug === 'quintal-de-casa';

  const filteredTables = useMemo(() => {
    if (!searchQuery.trim()) return tables;
    return tables.filter(t => String(t.number).includes(searchQuery.trim()));
  }, [tables, searchQuery]);

  const isFinishedOrder = (o: Order) =>
    o.status === 'cancelado' || o.status === 'concluido' || o.status === 'finalizado' || !!o.completedAt;

  // Cartão da mesa mostra o pedido para o qual a mesa aponta (ou o aberto mais recente).
  const activeMesaOrders = useMemo(() => {
    const map = new Map<number, Order>();
    const tableNums = new Set<number>();
    orders.forEach(o => { if (o.orderType === 'mesa' && o.tableNumber) tableNums.add(Number(o.tableNumber)); });
    tableNums.forEach(num => {
      const linkedId = tables.find(t => t.number === num)?.orderId;
      const picked = pickTableOrder(orders, num, linkedId);
      if (picked) map.set(num, picked);
    });
    return map;
  }, [orders, tables]);

  const occupiedTables = useMemo(() => {
    return filteredTables.filter(t => {
      if (activeMesaOrders.has(t.number)) return true;
      if (t.status !== 'occupied') return false;
      // Mesa ocupada cujo pedido já foi finalizado/cancelado: tratar como livre.
      // Pedido vinculado ainda não carregado mantém a mesa ocupada (nunca some sozinha).
      const linked = t.orderId ? orders.find(o => o.id === t.orderId) : undefined;
      if (linked && isFinishedOrder(linked)) return false;
      return true;
    });
  }, [filteredTables, activeMesaOrders, orders]);

  // Confere no banco se o pedido ainda tem itens/valor antes de qualquer descarte.
  const serverOrderHasContent = async (orderId: string) => {
    const { data, error } = await supabase.from('orders').select('items,total,status').eq('id', orderId).maybeSingle();
    if (error) return true; // na dúvida, não apaga
    return !canDeleteOrder(data as any, false);
  };

  const occupiedNumbers = useMemo(() => new Set(occupiedTables.map(t => t.number)), [occupiedTables]);

  const availableTables = useMemo(() => {
    return filteredTables.filter(t => !occupiedNumbers.has(t.number));
  }, [filteredTables, occupiedNumbers]);

  const handleTableClick = async (tableNum: number) => {
    const table = tables.find(t => t.number === tableNum);
    const activeOrderForTable = activeMesaOrders.get(tableNum) || orders.find(o => Number(o.tableNumber) === tableNum && o.orderType === 'mesa' && !isFinishedOrder(o));
    const isOccupied = occupiedNumbers.has(tableNum) || !!activeOrderForTable;

    let targetOrder: Order;

    if (isOccupied) {
      const existingId = activeOrderForTable?.id || table?.orderId;
      targetOrder = orders.find(o => o.id === existingId) || activeOrderForTable || {
        id: existingId || crypto.randomUUID(),
        openedBy: user?.id,
        openedByName: user?.name,
        items: [],
        total: 0,
        orderType: 'mesa',
        status: 'aberto',
        tableNumber: tableNum,
        createdAt: new Date().toISOString(),
      };
    } else {
      // A tela pode estar alguns segundos atrasada: confere no banco se outro aparelho já abriu a mesa.
      let serverOpen: Order | null = null;
      if (user?.tenantId) {
        const { data } = await supabase.from('orders').select('*')
          .eq('tenant_id', user.tenantId)
          .eq('order_type', 'mesa')
          .eq('table_number', tableNum)
          .in('status', ['aberto', 'segurado'])
          .order('created_at', { ascending: false })
          .limit(1);
        if (data && data[0]) serverOpen = dbToOrder(data[0]);
      }
      targetOrder = serverOpen || {
        id: crypto.randomUUID(),
        openedBy: user?.id,
        openedByName: user?.name,
        items: [],
        total: 0,
        orderType: 'mesa' as const,
        status: 'aberto' as const,
        tableNumber: tableNum,
        createdAt: new Date().toISOString(),
      };
      if (serverOpen) {
        const found = serverOpen;
        setOrders(prev => prev.some(o => o.id === found.id) ? prev.map(o => o.id === found.id ? found : o) : [found, ...prev]);
      }
    }

    setConsumerOrderModal({ open: true, order: targetOrder, tableNumber: tableNum });
  };

  const handleSaveConsumerOrder = async (updatedOrder: Order) => {
    const hasItems = (updatedOrder.items && updatedOrder.items.length > 0) || (updatedOrder.total || 0) > 0 || updatedOrder.isLocked || updatedOrder.status === 'segurado';

    if (!hasItems) {
      // Só descarta quando o banco também não tem nada; senão grava o pedido (a mesa continua ocupada).
      if (!(await serverOrderHasContent(updatedOrder.id))) {
        setOrders(prev => prev.filter(o => o.id !== updatedOrder.id));
        if (updatedOrder.tableNumber) freeTable(Number(updatedOrder.tableNumber), updatedOrder.id);
        return;
      }
    }

    setOrders(prev => {
      const exists = prev.some(o => o.id === updatedOrder.id);
      if (exists) {
        return prev.map(o => (o.id === updatedOrder.id
          ? { ...updatedOrder, paymentSplits: updatedOrder.paymentSplits ?? o.paymentSplits }
          : o));
      }
      return [updatedOrder, ...prev];
    });

    // A própria gravação do pedido vincula a mesa depois que o pedido foi confirmado no banco.
  };

  // Only discards drafts that are truly empty. An occupied table with items/value
  // must stay occupied until the user explicitly finalizes, deletes or transfers it.
  const handleDiscardEmptyOrder = async (orderId: string, tableNum?: number) => {
    const existing = orders.find(o => o.id === orderId);
    if (existing && ((existing.items?.length || 0) > 0 || (existing.total || 0) > 0)) {
      console.warn(`[Mesas] Blocked discard of order ${orderId}: it still has items/value.`);
      return;
    }
    if (await serverOrderHasContent(orderId)) {
      console.warn(`[Mesas] Blocked discard of order ${orderId}: the database still has items/value.`);
      return;
    }

    setOrders(prev => prev.filter(o => o.id !== orderId));
    if (tableNum) await freeTable(Number(tableNum), orderId);
  };

  const handleDeleteConsumerOrder = async (orderId: string, tableNum?: number) => {
    allowOrderDelete(orderId);
    // Exclui primeiro no banco (que libera a mesa deste pedido) e só depois atualiza a tela.
    try { await supabase.from('orders').delete().eq('id', orderId); } catch {}
    setOrders(prev => prev.filter(o => o.id !== orderId));
    if (tableNum) await freeTable(Number(tableNum), orderId);
  };

  const handlePrintConsumerKitchen = async (orderToPrint: Order, intent: 'new' | 'reprint' = 'new') => {
    try {
      return await printOrder(orderToPrint, { intent });
    } catch (err: any) {
      console.error('[Mesas] Falha ao imprimir comanda:', err);
      return { ok: false, reason: err?.message || 'Erro ao imprimir comanda da cozinha.' };
    }
  };

  const handlePrintConsumerBill = async (orderToPrint: Order) => {
    try {
      await printBill(orderToPrint);
      toast.success('Conta do cliente enviada para impressão!');
    } catch (err: any) {
      toast.error('Erro ao imprimir conta: ' + (err?.message || 'Verifique a impressora'));
    }
  };

  const handleTransfer = async (toTableNum: number) => {
    const fromNum = transferModal.fromTable;
    if (!fromNum) return;
    const fromTable = tables.find(t => t.number === fromNum);
    if (!fromTable || !fromTable.orderId) return;

    try {
      await moveOrderTable(fromTable.orderId, toTableNum);
      toast.success(`Mesa ${fromNum} transferida para Mesa ${toTableNum}`);
    } catch (err: any) {
      toast.error('Não foi possível transferir a mesa: ' + (err?.message || 'erro'));
    }
    setTransferModal({ open: false, fromTable: null });
  };

  const handleMerge = async (targetTableNum: number) => {
    const sourceNum = mergeModal.sourceTable;
    if (!sourceNum) return;
    const sourceTable = tables.find(t => t.number === sourceNum);
    const targetTable = tables.find(t => t.number === targetTableNum);
    if (!sourceTable?.orderId || !targetTable?.orderId) return;

    const sourceOrder = orders.find(o => o.id === sourceTable.orderId);
    const targetOrder = orders.find(o => o.id === targetTable.orderId);
    if (!sourceOrder || !targetOrder) return;

    const mergedItems = [...targetOrder.items];
    for (const item of sourceOrder.items) {
      const existing = mergedItems.find(i => i.productId === item.productId && !i.weight && !item.weight);
      if (existing) {
        existing.quantity += item.quantity;
        existing.subtotal = existing.quantity * existing.price;
      } else {
        mergedItems.push({ ...item, id: crypto.randomUUID() });
      }
    }
    const newTotal = mergedItems.reduce((s, i) => s + i.subtotal, 0);

    const sourceOrderId = sourceTable.orderId;
    allowOrderDelete(sourceOrderId);
    setOrders(prev => prev
      .map(o => o.id === targetTable.orderId ? { ...o, items: mergedItems, total: newTotal } : o)
      .filter(o => o.id !== sourceOrderId)
    );
    // A exclusão do pedido de origem no banco libera a mesa dele; aqui só atualiza a tela.
    try { await supabase.from('orders').delete().eq('id', sourceOrderId); } catch {}
    await freeTable(sourceNum, sourceOrderId);

    setMergeModal({ open: false, sourceTable: null });
    toast.success(`Mesa ${sourceNum} mesclada com Mesa ${targetTableNum}`);
  };

  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 pb-24 max-w-6xl mx-auto">
      {/* Header matching Anexo 1 design system */}
      <header className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground leading-tight">
          Mesas e Comandas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie o atendimento, comanda e ocupação das mesas em tempo real
        </p>
      </header>

      {lastSyncError && (
        <div role="alert" className="mb-4 border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {lastSyncError}
        </div>
      )}

      {/* Search Input Bar matching Anexo 1 */}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Digite o nº da mesa/comanda..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-10 h-11 bg-card border-border rounded-xl text-sm shadow-2xs focus-visible:ring-primary"
        />
      </div>

      <div className="space-y-6">
        {/* Pedidos em Andamento */}
        {occupiedTables.length > 0 && (
          <div>
            <h2 className="text-xs font-bold tracking-wider text-section-vendas uppercase flex items-center gap-1.5 mb-3">
              <span className="text-base">•</span> Pedidos em andamento ({occupiedTables.length})
            </h2>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-6 gap-2.5">
              {occupiedTables.map(table => {
                const order = activeMesaOrders.get(table.number) || orders.find(o => o.id === table.orderId);
                const attendantName = order ? getOrderAttendantName(order) : 'Não informado';
                const generalNotes = order?.pickupNotes?.trim();
                let minutesOpen = 0;
                if (order?.createdAt) {
                  try {
                    const d = new Date(order.createdAt);
                    if (!isNaN(d.getTime())) {
                      minutesOpen = Math.max(0, differenceInMinutes(currentTime, d));
                    }
                  } catch { }
                }
                const isBlocked = order?.isLocked === true;
                const cardBg = isBlocked
                  ? 'bg-amber-600 dark:bg-amber-700 text-white border-amber-500/30'
                  : 'bg-emerald-600 dark:bg-emerald-700 text-white border-emerald-500/30';
                const customer = order?.customerId ? customers.find(c => c.id === order.customerId) : null;
                const custName = customer?.name || order?.customerName || '';

                return (
                  <button
                    key={table.number}
                    onClick={() => handleTableClick(table.number)}
                    className={`relative w-full aspect-square lg:aspect-auto lg:min-h-44 flex flex-col justify-between p-2 lg:p-3 rounded-xl shadow-xs hover:shadow-md hover:brightness-105 active:scale-95 transition-all text-left overflow-hidden border ${cardBg}`}
                  >
                    <div className="flex justify-between items-start w-full lg:gap-2">
                      <span className="hidden lg:block min-w-0 flex-1 break-words text-[11px] font-bold opacity-90" title={attendantName}>
                        {attendantName}
                      </span>
                      {isBlocked ? (
                        <Lock className="h-3.5 w-3.5 shrink-0 opacity-90" />
                      ) : (
                        <div className="h-3.5 w-3.5 lg:hidden" />
                      )}
                      <span className="text-[10px] sm:text-[11px] font-bold opacity-90 whitespace-nowrap">
                        {Math.floor(minutesOpen / 1440) > 0 ? `${Math.floor(minutesOpen / 1440)} dias` : `${minutesOpen} min`}
                      </span>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center -mt-0.5 sm:-mt-1 lg:mt-0 lg:py-3">
                      <p className="text-2xl sm:text-3xl font-extrabold tracking-tighter drop-shadow-xs">
                        {String(table.number).padStart(2, '0')}
                      </p>
                      {custName && (
                        <p className="text-[10px] sm:text-xs font-semibold mt-0.5 truncate w-[110%] px-1 text-center opacity-95">
                          {custName}
                        </p>
                      )}
                    </div>

                    <div className="w-full pt-1">
                      {generalNotes && (
                        <p className="hidden lg:block mb-2 whitespace-pre-wrap break-words text-[11px] font-bold opacity-90">
                          {generalNotes}
                        </p>
                      )}
                      <p className="text-[11px] sm:text-[13px] font-extrabold drop-shadow-xs">
                        R$ {fmt(order?.total || 0)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Mesas Livres */}
        {availableTables.length > 0 && (
          <div>
            <h2 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5 mb-3">
              <span className="text-base">•</span> Mesas/Comandas livres ({availableTables.length})
            </h2>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2.5 shrink-0">
              {availableTables.map(table => (
                <button
                  key={table.number}
                  onClick={() => handleTableClick(table.number)}
                  className="w-full aspect-square bg-slate-200/70 dark:bg-slate-800/80 hover:bg-slate-300/80 dark:hover:bg-slate-700/90 text-slate-900 dark:text-slate-100 border border-slate-300/90 dark:border-slate-700 active:scale-95 transition-all flex flex-col items-center justify-center rounded-xl shadow-xs"
                >
                  <span className="text-[9px] sm:text-[10px] font-extrabold mb-0.5 tracking-wider text-red-600 dark:text-red-400">ABRIR</span>
                  <p className="text-2xl sm:text-3xl font-extrabold tracking-tighter text-slate-900 dark:text-slate-100">
                    {String(table.number).padStart(2, '0')}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Transfer Modal */}
      <Dialog open={transferModal.open} onOpenChange={() => setTransferModal({ open: false, fromTable: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transferir Mesa {transferModal.fromTable}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Selecione a mesa de destino:</p>
          {availableTables.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Nenhuma mesa disponível</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {availableTables.map(t => (
                <Button
                  key={t.number}
                  variant="outline"
                  className="h-14 text-base font-semibold hover:bg-primary hover:text-primary-foreground"
                  onClick={() => handleTransfer(t.number)}
                >
                  {t.number}
                </Button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Merge Modal */}
      <Dialog open={mergeModal.open} onOpenChange={() => setMergeModal({ open: false, sourceTable: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mesclar Mesa {mergeModal.sourceTable}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Os itens da Mesa {mergeModal.sourceTable} serão adicionados à mesa selecionada:
          </p>
          {occupiedTables.filter(t => t.number !== mergeModal.sourceTable).length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Nenhuma outra mesa ocupada</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {occupiedTables
                .filter(t => t.number !== mergeModal.sourceTable)
                .map(t => (
                  <Button
                    key={t.number}
                    variant="outline"
                    className="h-14 text-base font-semibold hover:bg-primary hover:text-primary-foreground"
                    onClick={() => handleMerge(t.number)}
                  >
                    {t.number}
                  </Button>
                ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Consumer Order Modal (tenant quintal-de-casa) */}
      <ConsumerOrderModal
        open={consumerOrderModal.open}
        onClose={() => setConsumerOrderModal({ open: false, order: null })}
        tableNumber={consumerOrderModal.tableNumber}
        order={consumerOrderModal.order}
        onSaveOrder={handleSaveConsumerOrder}
        onPrintOrder={handlePrintConsumerKitchen}
        onPrintBill={handlePrintConsumerBill}
        onDiscardEmptyOrder={handleDiscardEmptyOrder}
        onDeleteOrder={handleDeleteConsumerOrder}
      />
    </div>
  );
};

export default Mesas;
