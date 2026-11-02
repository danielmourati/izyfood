import React, { useState } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { fmt } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useOrderHistory, ORDER_HISTORY_PAGE_SIZE } from '@/hooks/use-order-history';
import { brazilToday } from '@/lib/query-pages';

const statusColors: Record<string, string> = {
  aberto: 'bg-primary/10 text-primary border border-primary/20',
  segurado: 'bg-warning/15 text-warning-foreground border border-warning/30',
  finalizado: 'bg-success/15 text-success border border-success/30',
  cancelado: 'bg-destructive/10 text-destructive border border-destructive/20',
};

const Pedidos = () => {
  const { setOrders } = useStore();
  const [filter, setFilter] = useState<string>('all');
  const [start, setStart] = useState(brazilToday);
  const [end, setEnd] = useState(brazilToday);
  const [page, setPage] = useState(0);
  const history = useOrderHistory(start, end, filter, page);
  const orders = history.data?.orders || [];

  const nonEmpty = orders.filter(o => o.total > 0 || (o.status !== 'cancelado' && o.items.length > 0));
  const filtered = filter === 'all' ? nonEmpty : nonEmpty.filter(o => o.status === filter);
  const sorted = [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const cancelOrder = (id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'cancelado' } : o));
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="text-2xl font-bold mb-4 text-foreground">Pedidos</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        <Input type="date" aria-label="Data inicial" className="w-auto" value={start} onChange={e => { setStart(e.target.value); setPage(0); }} />
        <Input type="date" aria-label="Data final" className="w-auto" value={end} onChange={e => { setEnd(e.target.value); setPage(0); }} />
        {['all', 'aberto', 'segurado', 'finalizado', 'cancelado'].map(f => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => { setFilter(f); setPage(0); }}>
            {f === 'all' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>
      {history.isError && <div className="mb-4 text-destructive">Não foi possível carregar o histórico. <Button variant="outline" onClick={() => void history.refetch()}>Tentar novamente</Button></div>}
      {(!start || !end || start > end) && <p className="mb-4 text-destructive">Informe um período válido.</p>}

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
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{history.isFetching ? 'Carregando pedidos…' : 'Nenhum pedido encontrado'}</TableCell></TableRow>
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
      <div className="flex items-center justify-end gap-3 mt-4">
        <Button variant="outline" disabled={page === 0 || history.isFetching} onClick={() => setPage(p => p - 1)}>Anterior</Button>
        <span className="text-sm text-muted-foreground">{page + 1} / {Math.max(1, Math.ceil((history.data?.count || 0) / ORDER_HISTORY_PAGE_SIZE))}</span>
        <Button variant="outline" disabled={history.isFetching || (page + 1) * ORDER_HISTORY_PAGE_SIZE >= (history.data?.count || 0)} onClick={() => setPage(p => p + 1)}>Próxima</Button>
      </div>
    </div>
  );
};

export default Pedidos;
