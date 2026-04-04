import React, { useState, useMemo } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { useTenantNavigate } from '@/hooks/use-tenant-navigate';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRightLeft, Merge } from 'lucide-react';
import { toast } from 'sonner';

const Mesas = () => {
  const { tables, setTables, orders, setOrders } = useStore();
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

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-foreground">Mesas</h1>
      <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
        {tables.map(table => (
          <div key={table.number} className="relative group">
            <button
              onClick={() => handleTableClick(table.number)}
              className={`w-full h-24 rounded-xl font-bold text-xl text-white transition-all active:scale-95 shadow-md hover:shadow-lg ${
                table.status === 'available'
                  ? 'bg-emerald-500 hover:bg-emerald-600'
                  : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {table.number}
              <p className="text-xs font-normal opacity-80">
                {table.status === 'available' ? 'Livre' : 'Ocupada'}
              </p>
            </button>
            {table.status === 'occupied' && (
              <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); setTransferModal({ open: true, fromTable: table.number }); }}
                  className="h-7 w-7 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md hover:bg-blue-600"
                  title="Transferir mesa"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                </button>
                {occupiedTables.length >= 2 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setMergeModal({ open: true, sourceTable: table.number }); }}
                    className="h-7 w-7 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-md hover:bg-purple-600"
                    title="Mesclar com outra mesa"
                  >
                    <Merge className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
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
