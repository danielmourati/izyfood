import React from 'react';
import { useStore } from '@/contexts/StoreContext';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

const Mesas = () => {
  const { tables, setTables, orders, setOrders } = useStore();
  const navigate = useNavigate();

  const handleTableClick = (tableNum: number) => {
    const table = tables.find(t => t.number === tableNum);
    if (!table) return;

    if (table.status === 'occupied' && table.orderId) {
      toast({ title: `Mesa ${tableNum}`, description: 'Abrindo pedido...' });
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
      toast({ title: `Mesa ${tableNum} aberta`, description: 'Novo pedido criado.' });
      navigate(`/pdv?mesa=${tableNum}&pedido=${newOrder.id}`);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-foreground">Mesas</h1>
      <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
        {tables.map(table => (
          <button
            key={table.number}
            onClick={() => handleTableClick(table.number)}
            className={`h-24 rounded-xl font-bold text-xl text-white transition-all active:scale-95 shadow-md hover:shadow-lg ${
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
        ))}
      </div>
    </div>
  );
};

export default Mesas;
