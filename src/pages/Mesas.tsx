import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { useTenantNavigate } from '@/hooks/use-tenant-navigate';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRightLeft, Merge, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { fmt } from '@/lib/utils';
import { differenceInMinutes } from 'date-fns';

const Mesas = () => {
  const { tables, setTables, orders, setOrders, customers } = useStore();
  const navigate = useTenantNavigate();
  const [transferModal, setTransferModal] = useState<{ open: boolean; fromTable: number | null }>({ open: false, fromTable: null });
  const [mergeModal, setMergeModal] = useState<{ open: boolean; sourceTable: number | null }>({ open: false, sourceTable: null });

  const occupiedTables = useMemo(() => tables.filter(t => t.status === 'occupied'), [tables]);
  const availableTables = useMemo(() => tables.filter(t => t.status === 'available'), [tables]);

  const handleTableClick = (tableNum: number) => {
    const table = tables.find(t => t.number === tableNum);
    if (!table) return;

    if (table.status === 'occupied' && table.orderId) {
      navigate(`/pdv?mesa=${tableNum}&pedido=${table.orderId}`);
    } else {
      const newOrder = {
        id: crypto.randomUUID(),
        items: [],
        total: 0,
        orderType: 'mesa' as const,
        status: 'aberto' as const,
        tableNumber: tableNum,
        createdAt: new Date().toISOString(),
      };
      setOrders(prev => [...prev, newOrder]);
      setTables(prev => prev.map(t =>
        t.number === tableNum ? { ...t, status: 'occupied', orderId: newOrder.id } : t
      ));
      navigate(`/pdv?mesa=${tableNum}&pedido=${newOrder.id}`);
    }
  };

  const handleTransfer = (toTableNum: number) => {
    const fromNum = transferModal.fromTable;
    if (!fromNum) return;
    const fromTable = tables.find(t => t.number === fromNum);
    if (!fromTable || !fromTable.orderId) return;

    const orderId = fromTable.orderId;

    // Update order table number
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, tableNumber: toTableNum } : o
    ));

    // Free old table, occupy new one
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

    // Merge items: combine items, summing quantities for same products
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

    // Update target order with merged items
    setOrders(prev => prev
      .map(o => o.id === targetTable.orderId ? { ...o, items: mergedItems, total: newTotal } : o)
      .filter(o => o.id !== sourceTable.orderId)
    );

    // Free source table
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
    <div className="h-full overflow-y-auto p-4 sm:p-6 pb-24 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground hover:opacity-90">Mesas</h1>
      </div>

      <div className="space-y-8">
        {/* Pedidos em Andamento */}
        {occupiedTables.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-foreground mb-4 drop-shadow-sm truncate">
              Pedidos em andamento ({occupiedTables.length})
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {occupiedTables.map(table => {
                const order = orders.find(o => o.id === table.orderId);
                const minutesOpen = order?.createdAt ? differenceInMinutes(currentTime, new Date(order.createdAt)) : 0;
                // e.g. yellow if > 45 minutes, green otherwise for testing logic
                const bgColor = minutesOpen > 45 ? 'bg-[#d9a036]' : 'bg-[#2e8c56]';
                const customer = order?.customerId ? customers.find(c => c.id === order.customerId) : null;
                const custName = customer?.name || order?.customerName || '';

                return (
                  <button
                    key={table.number}
                    onClick={() => handleTableClick(table.number)}
                    className={`relative w-full aspect-[4/5] sm:aspect-square flex flex-col justify-between p-2 rounded-sm text-white shadow-sm hover:brightness-110 active:scale-95 transition-all text-left overflow-hidden ${bgColor}`}
                  >
                    <div className="flex justify-between items-start w-full">
                      <Lock className="h-4 w-4 shrink-0 opacity-80" />
                      <span className="text-[10px] sm:text-[11px] font-bold opacity-90 drop-shadow-sm shadow-black whitespace-nowrap">
                        {Math.floor(minutesOpen / 1440) > 0 ? `${Math.floor(minutesOpen / 1440)} dias` : `${minutesOpen} min`}
                      </span>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center -mt-1 sm:-mt-2">
                      <p className="text-4xl sm:text-5xl font-bold drop-shadow-sm tracking-tighter">
                        {String(table.number).padStart(2, '0')}
                      </p>
                      {custName && (
                        <p className="text-[10px] sm:text-xs font-semibold mt-1 truncate w-[110%] px-1 text-center opacity-95">
                          {custName}
                        </p>
                      )}
                    </div>

                    <div className="w-full pt-1">
                      <p className="text-[11px] sm:text-[13px] font-extrabold drop-shadow-sm">
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
            <h2 className="text-xl font-bold text-foreground mb-4 drop-shadow-sm">
              Mesas/Comandas livres ({availableTables.length})
            </h2>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 shrink-0">
              {availableTables.map(table => (
                <button
                  key={table.number}
                  onClick={() => handleTableClick(table.number)}
                  className="w-full aspect-square bg-[#666666] hover:bg-[#555555] active:scale-95 transition-all flex flex-col items-center justify-center rounded-sm text-white shadow-sm"
                >
                  <span className="text-[9px] sm:text-[10px] font-bold mb-0.5 tracking-wider">ABRIR</span>
                  <p className="text-2xl sm:text-3xl font-extrabold tracking-tighter shadow-black drop-shadow-md">
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
                    className="h-14 text-base font-semibold hover:bg-purple-500 hover:text-white"
                    onClick={() => handleMerge(t.number)}
                  >
                    {t.number}
                  </Button>
                ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Mesas;
