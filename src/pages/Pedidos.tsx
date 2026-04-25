import React, { useState } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { fmt } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const statusColors: Record<string, string> = {
  aberto: 'bg-blue-100 text-blue-800',
  segurado: 'bg-yellow-100 text-yellow-800',
  finalizado: 'bg-emerald-100 text-emerald-800',
  cancelado: 'bg-red-100 text-red-800',
};

const Pedidos = () => {
  const { orders, setOrders } = useStore();
  const [filter, setFilter] = useState<string>('all');

  const nonEmpty = orders.filter(o => o.total > 0 || (o.status !== 'cancelado' && o.items.length > 0));
  const filtered = filter === 'all' ? nonEmpty : nonEmpty.filter(o => o.status === filter);
  const sorted = [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const cancelOrder = (id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'cancelado' } : o));
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="text-2xl font-bold mb-4 text-foreground">Pedidos</h1>

      <div className="flex gap-2 mb-4">
        {['all', 'aberto', 'segurado', 'finalizado', 'cancelado'].map(f => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)}>
            {f === 'all' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado</TableCell></TableRow>
            ) : sorted.map(order => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-xs">#{order.id.slice(0, 6)}</TableCell>
                <TableCell className="capitalize">{order.orderType}</TableCell>
                <TableCell>{order.items.length} itens</TableCell>
                <TableCell className="font-semibold">R$ {fmt(order.total)}</TableCell>
                <TableCell>
                  <Badge className={statusColors[order.status] || ''}>{order.status}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(order.createdAt).toLocaleString('pt-BR')}
                </TableCell>
                <TableCell>
                  {(order.status === 'aberto' || order.status === 'segurado') && (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => cancelOrder(order.id)}>
                      Cancelar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Pedidos;
