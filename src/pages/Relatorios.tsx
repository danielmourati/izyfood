import React, { useState, useMemo } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { fmt } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, ShoppingBag, TrendingUp, AlertTriangle, CalendarIcon } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, isWithinInterval, eachDayOfInterval, isAfter, isBefore, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = ['hsl(152,45%,28%)', 'hsl(145,55%,42%)', 'hsl(38,92%,50%)', 'hsl(0,72%,51%)'];

type PresetKey = 'hoje' | 'ontem' | 'esta_semana' | 'semana_passada' | 'este_mes' | 'mes_passado' | 'custom';

const presets: { key: PresetKey; label: string; getRange: () => { from: Date; to: Date } }[] = [
  { key: 'hoje', label: 'Hoje', getRange: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { key: 'ontem', label: 'Ontem', getRange: () => ({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) }) },
  { key: 'esta_semana', label: 'Esta Semana', getRange: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfDay(new Date()) }) },
  { key: 'semana_passada', label: 'Semana Passada', getRange: () => {
    const lastWeek = subWeeks(new Date(), 1);
    return { from: startOfWeek(lastWeek, { weekStartsOn: 1 }), to: endOfWeek(lastWeek, { weekStartsOn: 1 }) };
  }},
  { key: 'este_mes', label: 'Este Mês', getRange: () => ({ from: startOfMonth(new Date()), to: endOfDay(new Date()) }) },
  { key: 'mes_passado', label: 'Mês Passado', getRange: () => {
    const lastMonth = subMonths(new Date(), 1);
    return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
  }},
];

const Relatorios = () => {
  const { sales, customers } = useStore();

  const [activePreset, setActivePreset] = useState<PresetKey>('hoje');
  const [customRange, setCustomRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pickingField, setPickingField] = useState<'from' | 'to'>('from');

  const dateRange = useMemo(() => {
    if (activePreset === 'custom' && customRange.from) {
      return { from: startOfDay(customRange.from), to: endOfDay(customRange.to || customRange.from) };
    }
    const preset = presets.find(p => p.key === activePreset);
    return preset ? preset.getRange() : presets[0].getRange();
  }, [activePreset, customRange]);

  const filteredSales = useMemo(() =>
    sales.filter(s => {
      const d = new Date(s.date);
      return isWithinInterval(d, { start: dateRange.from, end: dateRange.to });
    }),
  [sales, dateRange]);

  const totalRevenue = useMemo(() => filteredSales.reduce((s, v) => s + v.total, 0), [filteredSales]);

  const salesByProduct = useMemo(() => {
    const map: Record<string, { name: string; total: number; qty: number }> = {};
    filteredSales.forEach(s => s.items.forEach(i => {
      if (!map[i.productId]) map[i.productId] = { name: i.name, total: 0, qty: 0 };
      map[i.productId].total += i.subtotal;
      map[i.productId].qty += i.quantity;
    }));
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [filteredSales]);

  const salesByMethod = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSales.forEach(s => { map[s.paymentMethod] = (map[s.paymentMethod] || 0) + s.total; });
    return Object.entries(map).map(([name, value]) => ({ name: name.toUpperCase(), value }));
  }, [filteredSales]);

  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    const map: Record<string, number> = {};
    days.forEach(d => { map[format(d, 'yyyy-MM-dd')] = 0; });
    filteredSales.forEach(s => {
      const day = s.date.split('T')[0];
      if (day in map) map[day] += s.total;
    });
    return Object.entries(map).map(([date, total]) => ({
      date: format(new Date(date), days.length > 14 ? 'dd/MM' : 'EEE dd', { locale: ptBR }),
      total,
    }));
  }, [filteredSales, dateRange]);

  const creditCustomers = customers.filter(c => c.creditBalance > 0);

  const selectPreset = (key: PresetKey) => {
    setActivePreset(key);
    setCalendarOpen(false);
  };

  const rangeLabelText = useMemo(() => {
    if (activePreset !== 'custom') {
      return presets.find(p => p.key === activePreset)?.label || '';
    }
    if (customRange.from && customRange.to) {
      return `${format(customRange.from, 'dd/MM/yyyy')} - ${format(customRange.to, 'dd/MM/yyyy')}`;
    }
    if (customRange.from) return format(customRange.from, 'dd/MM/yyyy');
    return 'Selecionar período';
  }, [activePreset, customRange]);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>

        {/* Date Range Selector */}
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 min-w-[200px] justify-start">
              <CalendarIcon className="h-4 w-4" />
              <span className="truncate">{rangeLabelText}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="flex">
              {/* Presets */}
              <div className="border-r p-2 space-y-0.5 w-[120px]">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-2 pb-1 block">Atalhos</span>
                {presets.map(p => (
                  <Button
                    key={p.key}
                    variant={activePreset === p.key ? 'default' : 'ghost'}
                    size="sm"
                    className="w-full justify-start text-[11px] h-7 px-2"
                    onClick={() => selectPreset(p.key)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              {/* Calendar */}
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPickingField('from')}
                    className={`flex-1 rounded-md border px-2.5 py-1.5 text-xs text-center cursor-pointer transition-colors ${pickingField === 'from' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/40'}`}
                  >
                    <span className="text-muted-foreground block text-[10px] leading-none mb-0.5">Início</span>
                    <span className="font-medium">
                      {customRange.from ? format(customRange.from, 'dd/MM/yyyy', { locale: ptBR }) : '-- / -- / ----'}
                    </span>
                  </button>
                  <span className="text-muted-foreground text-xs">→</span>
                  <button
                    type="button"
                    onClick={() => { if (customRange.from) setPickingField('to'); }}
                    className={`flex-1 rounded-md border px-2.5 py-1.5 text-xs text-center transition-colors ${!customRange.from ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${pickingField === 'to' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/40'}`}
                  >
                    <span className="text-muted-foreground block text-[10px] leading-none mb-0.5">Fim</span>
                    <span className="font-medium">
                      {customRange.to ? format(customRange.to, 'dd/MM/yyyy', { locale: ptBR }) : '-- / -- / ----'}
                    </span>
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">
                  {pickingField === 'from' ? 'Selecione a data de início' : 'Selecione a data final'}
                </p>
                <Calendar
                  mode="single"
                  selected={pickingField === 'from' ? customRange.from : customRange.to}
                  onSelect={(day) => {
                    if (!day) return;
                    setActivePreset('custom');
                    if (pickingField === 'from') {
                      setCustomRange({ from: day, to: customRange.to && day <= customRange.to ? customRange.to : undefined });
                      setPickingField('to');
                    } else {
                      if (customRange.from && day < customRange.from) {
                        setCustomRange({ from: day, to: undefined });
                        setPickingField('to');
                      } else {
                        setCustomRange(prev => ({ ...prev, to: day }));
                        if (customRange.from) setCalendarOpen(false);
                      }
                    }
                  }}
                  locale={ptBR}
                  numberOfMonths={1}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <DollarSign className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground">Vendas</p>
              <p className="text-lg md:text-2xl font-bold text-foreground truncate">R$ {fmt(totalRevenue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <ShoppingBag className="h-5 w-5 md:h-6 md:w-6 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground">Pedidos</p>
              <p className="text-lg md:text-2xl font-bold text-foreground">{filteredSales.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground">Total Geral</p>
              <p className="text-lg md:text-2xl font-bold text-foreground truncate">R$ {fmt(sales.reduce((s, v) => s + v.total, 0))}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 md:h-6 md:w-6 text-destructive" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground">Fiados</p>
              <p className="text-lg md:text-2xl font-bold text-foreground truncate">R$ {fmt(creditCustomers.reduce((s, c) => s + c.creditBalance, 0))}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <Card>
          <CardHeader><CardTitle>Vendas no Período</CardTitle></CardHeader>
          <CardContent>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v: number) => `R$ ${fmt(v)}`} />
                  <Bar dataKey="total" fill="hsl(152,45%,28%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-muted-foreground py-12">Sem dados no período</p>}
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
                  <Tooltip formatter={(v: number) => `R$ ${fmt(v)}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-muted-foreground py-12">Sem dados no período</p>}
          </CardContent>
        </Card>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
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
                      <TableCell className="font-semibold">R$ {fmt(p.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <p className="text-center text-muted-foreground py-8">Sem dados no período</p>}
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
                      <TableCell className="font-semibold text-destructive">R$ {fmt(c.creditBalance)}</TableCell>
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
