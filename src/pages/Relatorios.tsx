import React, { useMemo } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { fmt } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { DollarSign, ShoppingBag, TrendingUp, AlertTriangle } from 'lucide-react';

const COLORS = ['hsl(152,45%,28%)', 'hsl(145,55%,42%)', 'hsl(38,92%,50%)', 'hsl(0,72%,51%)'];

const Relatorios = () => {
  const { sales, customers, products } = useStore();

  const today = new Date().toISOString().split('T')[0];
  const todaySales = useMemo(() => sales.filter(s => s.date.startsWith(today)), [sales, today]);
  const todayTotal = useMemo(() => todaySales.reduce((s, sale) => s + sale.total, 0), [todaySales]);

  const salesByProduct = useMemo(() => {
    const map: Record<string, { name: string; total: number; qty: number }> = {};
    sales.forEach(s => s.items.forEach(i => {
      if (!map[i.productId]) map[i.productId] = { name: i.name, total: 0, qty: 0 };
      map[i.productId].total += i.subtotal;
      map[i.productId].qty += i.quantity;
    }));
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [sales]);

  const salesByMethod = useMemo(() => {
    const map: Record<string, number> = {};
    sales.forEach(s => { map[s.paymentMethod] = (map[s.paymentMethod] || 0) + s.total; });
    return Object.entries(map).map(([name, value]) => ({ name: name.toUpperCase(), value }));
  }, [sales]);

  const last7Days = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days[d.toISOString().split('T')[0]] = 0;
    }
    sales.forEach(s => {
      const day = s.date.split('T')[0];
      if (day in days) days[day] += s.total;
    });
    return Object.entries(days).map(([date, total]) => ({
      date: new Date(date).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
      total,
    }));
  }, [sales]);

  const creditCustomers = customers.filter(c => c.creditBalance > 0);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vendas Hoje</p>
              <p className="text-2xl font-bold text-foreground">R$ {fmt(todayTotal)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <ShoppingBag className="h-6 w-6 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pedidos Hoje</p>
              <p className="text-2xl font-bold text-foreground">{todaySales.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Geral</p>
              <p className="text-2xl font-bold text-foreground">R$ {sales.reduce((s, v) => s + v.total, 0).toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fiados Abertos</p>
              <p className="text-2xl font-bold text-foreground">R$ {creditCustomers.reduce((s, c) => s + c.creditBalance, 0).toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Vendas - Últimos 7 Dias</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={last7Days}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                <Bar dataKey="total" fill="hsl(152,45%,28%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Vendas por Forma de Pagamento</CardTitle></CardHeader>
          <CardContent>
            {salesByMethod.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={salesByMethod} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {salesByMethod.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">Sem dados ainda</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Top Produtos</CardTitle></CardHeader>
          <CardContent>
            {salesByProduct.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesByProduct.map(p => (
                    <TableRow key={p.name}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.qty}</TableCell>
                      <TableCell className="font-semibold">R$ {p.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <p className="text-center text-muted-foreground py-8">Sem dados ainda</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Clientes com Fiado</CardTitle></CardHeader>
          <CardContent>
            {creditCustomers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Débito</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditCustomers.map(c => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>{c.phone}</TableCell>
                      <TableCell className="font-semibold text-destructive">R$ {c.creditBalance.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <p className="text-center text-muted-foreground py-8">Nenhum fiado aberto</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Relatorios;
