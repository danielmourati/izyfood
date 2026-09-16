import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantNavigate } from '@/hooks/use-tenant-navigate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRightLeft, Merge, Lock, Utensils, Store, Bike, ShoppingBag, Menu, Search } from 'lucide-react';
import { toast } from 'sonner';
import { fmt } from '@/lib/utils';
import { differenceInMinutes } from 'date-fns';
import { ConsumerOrderModal } from '@/components/consumer/ConsumerOrderModal';
import { usePrinter } from '@/hooks/use-printer';
import { Order } from '@/types';
import { supabase } from '@/integrations/supabase/client';

const Mesas = () => {
  const { tables, setTables, orders, setOrders, customers, freeTable, occupyTable } = useStore();
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

  const activeMesaOrders = useMemo(() => {
    const map = new Map<number, Order>();
    orders.forEach(o => {
      if (o.orderType === 'mesa' && o.tableNumber && o.status !== 'cancelado' && o.status !== 'concluido') {
        if ((o.items && o.items.length > 0) || o.isLocked || o.status === 'segurado') {
          map.set(Number(o.tableNumber), o);
        }
      }
    });
    return map;
  }, [orders]);

  const occupiedTables = useMemo(() => {
    return filteredTables.filter(t => t.status === 'occupied' || activeMesaOrders.has(t.number));
  }, [filteredTables, activeMesaOrders]);

  const availableTables = useMemo(() => {
    return filteredTables.filter(t => t.status !== 'occupied' && !activeMesaOrders.has(t.number));
  }, [filteredTables, activeMesaOrders]);

  const handleTableClick = (tableNum: number) => {
    const table = tables.find(t => t.number === tableNum);
    const activeOrderForTable = activeMesaOrders.get(tableNum) || orders.find(o => Number(o.tableNumber) === tableNum && o.status !== 'cancelado' && o.status !== 'concluido');
    const isOccupied = (table && table.status === 'occupied') || !!activeOrderForTable;

    let targetOrder: Order;

    if (isOccupied) {
      const existingId = activeOrderForTable?.id || table?.orderId;
      targetOrder = orders.find(o => o.id === existingId) || activeOrderForTable || {
        id: existingId || crypto.randomUUID(),
        items: [],
        total: 0,
        orderType: 'mesa',
        status: 'aberto',
        tableNumber: tableNum,
        createdAt: new Date().toISOString(),
      };
    } else {
      targetOrder = {
        id: crypto.randomUUID(),
        items: [],
        total: 0,
        orderType: 'mesa' as const,
        status: 'aberto' as const,
        tableNumber: tableNum,
        createdAt: new Date().toISOString(),
      };
    }

    setConsumerOrderModal({ open: true, order: targetOrder, tableNumber: tableNum });
  };

  const handleSaveConsumerOrder = (updatedOrder: Order) => {
    setOrders(prev => {
      const exists = prev.some(o => o.id === updatedOrder.id);
      if (exists) {
        return prev.map(o => (o.id === updatedOrder.id ? updatedOrder : o));
      }
      return [updatedOrder, ...prev];
    });

    if (updatedOrder.tableNumber) {
      const numMesa = Number(updatedOrder.tableNumber);
      setTables(prev => prev.map(t =>
        t.number === numMesa
          ? { ...t, status: 'occupied', orderId: updatedOrder.id }
          : t
      ));
      if (occupyTable) {
        occupyTable(numMesa, updatedOrder.id);
      }
    }
  };

  // Only discards drafts that are truly empty. An occupied table with items/value
  // must stay occupied until the user explicitly finalizes, deletes or transfers it.
  const handleDiscardEmptyOrder = async (orderId: string, tableNum?: number) => {
    const existing = orders.find(o => o.id === orderId);
    if (existing && ((existing.items?.length || 0) > 0 || (existing.total || 0) > 0)) {
      console.warn(`[Mesas] Blocked discard of order ${orderId}: it still has items/value.`);
      return;
    }

    setOrders(prev => prev.filter(o => o.id !== orderId));
    if (tableNum) await freeTable(Number(tableNum));
    try { await supabase.from('orders').delete().eq('id', orderId); } catch {}
  };

  const handleDeleteConsumerOrder = async (orderId: string, tableNum?: number) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
    if (tableNum) await freeTable(Number(tableNum));
    try { await supabase.from('orders').delete().eq('id', orderId); } catch {}
  };

  const handlePrintConsumerKitchen = async (orderToPrint: Order) => {
    try {
      await printOrder(orderToPrint);
      toast.success('Comanda enviada para a Cozinha!');
    } catch (err: any) {
      toast.error('Erro ao imprimir comanda da cozinha.');
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

  const handleTransfer = (toTableNum: number) => {
    const fromNum = transferModal.fromTable;
    if (!fromNum) return;
    const fromTable = tables.find(t => t.number === fromNum);
    if (!fromTable || !fromTable.orderId) return;

    const orderId = fromTable.orderId;

    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, tableNumber: toTableNum } : o
    ));

    setTables(prev => prev.map(t => {
      if (t.number === fromNum) return { ...t, status: 'available' as const, orderId: undefined };
      if (t.number === toTableNum) return { ...t, status: 'occupied' as const, orderId };
      return t;
    }));

    setTransferModal({ open: false, fromTable: null });
    toast.success(`Mesa ${fromNum} transferida para Mesa ${toTableNum}`);
  };

  const handleMerge = (targetTableNum: number) => {
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

    setOrders(prev => prev
      .map(o => o.id === targetTable.orderId ? { ...o, items: mergedItems, total: newTotal } : o)
      .filter(o => o.id !== sourceTable.orderId)
    );

    setTables(prev => prev.map(t => {
      if (t.number === sourceNum) return { ...t, status: 'available' as const, orderId: undefined };
      return t;
    }));

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
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
              {occupiedTables.map(table => {
                const order = orders.find(o => o.id === table.orderId);
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
                    className={`relative w-full aspect-square flex flex-col justify-between p-2 rounded-xl shadow-xs hover:shadow-md hover:brightness-105 active:scale-95 transition-all text-left overflow-hidden border ${cardBg}`}
                  >
                    <div className="flex justify-between items-start w-full">
                      {isBlocked ? (
                        <Lock className="h-3.5 w-3.5 shrink-0 opacity-90" />
                      ) : (
                        <div className="h-3.5 w-3.5" />
                      )}
                      <span className="text-[10px] sm:text-[11px] font-bold opacity-90 whitespace-nowrap">
                        {Math.floor(minutesOpen / 1440) > 0 ? `${Math.floor(minutesOpen / 1440)} dias` : `${minutesOpen} min`}
                      </span>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center -mt-0.5 sm:-mt-1">
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
                  className="w-full aspect-square bg-card hover:bg-muted/80 text-card-foreground border border-border/80 active:scale-95 transition-all flex flex-col items-center justify-center rounded-xl shadow-2xs hover:shadow-xs"
                >
                  <span className="text-[9px] sm:text-[10px] font-bold mb-0.5 tracking-wider text-primary opacity-90">ABRIR</span>
                  <p className="text-2xl sm:text-3xl font-extrabold tracking-tighter text-foreground drop-shadow-2xs">
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
