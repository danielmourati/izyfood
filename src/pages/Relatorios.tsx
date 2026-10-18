import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { fmt } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, ShoppingBag, TrendingUp, AlertTriangle, CalendarIcon, ChevronDown, ChevronRight, Users, UserCheck, Package, Printer, Download, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const { sales, customers, products, categories, getCategoryById, orders, settings, printSettings } = useStore();
  const { user } = useAuth();

  const [activePreset, setActivePreset] = useState<PresetKey>('hoje');
  const [customRange, setCustomRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pickingField, setPickingField] = useState<'from' | 'to'>('from');
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState<'todos' | 'categoria' | 'baixo' | 'mais' | 'menos'>('todos');
  const [productCategoryId, setProductCategoryId] = useState<string>('all');
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(5);

  // Attendants reporting state
  const [attendantsList, setAttendantsList] = useState<{ id: string; name: string; commission: number }[]>([]);
  const [selectedAttendantId, setSelectedAttendantId] = useState<string>('all');
  const [attendantSearchQuery, setAttendantSearchQuery] = useState<string>('');
  const [expandedAttendantId, setExpandedAttendantId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAttendants() {
      try {
        const { data: members } = await supabase.from('tenant_members').select('user_id, commission_percentage, role');
        const { data: profiles } = await supabase.from('profiles').select('id, name');
        if (members) {
          const list = members
            .filter((m: any) => m.role === 'atendente' || m.role === 'admin')
            .map((m: any) => {
              const p = profiles?.find((pr: any) => pr.id === m.user_id);
              return {
                id: m.user_id,
                name: p?.name || `Atendente (${m.user_id.slice(0, 6)})`,
                commission: Number(m.commission_percentage || 0),
              };
            });
          setAttendantsList(list);
        }
      } catch (err) {
        console.error('Erro ao carregar atendentes:', err);
      }
    }
    fetchAttendants();
  }, []);

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

  // Customer purchase stats
  const customerStats = useMemo(() => {
    const map: Record<string, { name: string; phone: string; count: number; total: number; loyaltyPoints: number; items: Record<string, { name: string; qty: number; weightTotal: number; total: number }> }> = {};
    filteredSales.forEach(s => {
      if (!s.customerId) return;
      const customer = customers.find(c => c.id === s.customerId);
      if (!customer) return;
      if (!map[s.customerId]) {
        map[s.customerId] = { name: customer.name, phone: customer.phone, count: 0, total: 0, loyaltyPoints: customer.loyaltyPoints || 0, items: {} };
      }
      map[s.customerId].count++;
      map[s.customerId].total += s.total;
      s.items.forEach(i => {
        if (!map[s.customerId!].items[i.productId]) {
          map[s.customerId!].items[i.productId] = { name: i.name, qty: 0, weightTotal: 0, total: 0 };
        }
        map[s.customerId!].items[i.productId].qty += i.quantity;
        map[s.customerId!].items[i.productId].weightTotal += i.weight || 0;
        map[s.customerId!].items[i.productId].total += i.subtotal;
      });
    });
    return Object.entries(map).map(([id, data]) => ({
      id,
      ...data,
      itemsList: Object.values(data.items).sort((a, b) => b.total - a.total),
    })).sort((a, b) => b.total - a.total);
  }, [filteredSales, customers]);

  // Sales quantities aggregated per product within the filtered period
  const productSalesMap = useMemo(() => {
    const map: Record<string, { qty: number; total: number }> = {};
    filteredSales.forEach(s => s.items.forEach(i => {
      if (!map[i.productId]) map[i.productId] = { qty: 0, total: 0 };
      map[i.productId].qty += i.quantity;
      map[i.productId].total += i.subtotal;
    }));
    return map;
  }, [filteredSales]);

  const productReport = useMemo(() => {
    const enriched = products.map(p => ({
      ...p,
      categoryName: getCategoryById(p.categoryId)?.name || '—',
      soldQty: productSalesMap[p.id]?.qty || 0,
      soldTotal: productSalesMap[p.id]?.total || 0,
    }));

    let list = enriched;
    let title = 'Todos os produtos';
    if (productFilter === 'categoria') {
      if (productCategoryId !== 'all') {
        const cat = categories.find(c => c.id === productCategoryId);
        list = list.filter(p => p.categoryId === productCategoryId);
        title = `Categoria: ${cat?.name || '—'}`;
      } else {
        title = 'Todas as categorias';
      }
      list = [...list].sort((a, b) => a.categoryName.localeCompare(b.categoryName) || a.name.localeCompare(b.name));
    } else if (productFilter === 'baixo') {
      list = list.filter(p => p.controlStock && p.stock <= lowStockThreshold)
        .sort((a, b) => a.stock - b.stock);
      title = `Estoque baixo (≤ ${lowStockThreshold})`;
    } else if (productFilter === 'mais') {
      list = [...list].filter(p => p.soldQty > 0).sort((a, b) => b.soldQty - a.soldQty);
      title = 'Mais vendidos';
    } else if (productFilter === 'menos') {
      list = [...list].filter(p => p.soldQty > 0).sort((a, b) => a.soldQty - b.soldQty || a.name.localeCompare(b.name));
      // descending of "menos vendidos" — user asked descending order; we show least sold first which is the typical interpretation
      title = 'Menos vendidos';
    } else {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return { list, title };
  }, [products, productSalesMap, productFilter, productCategoryId, lowStockThreshold, categories, getCategoryById]);

  const handlePrintProducts = () => {
    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) {
      alert('Permita popups para imprimir.');
      return;
    }
    const periodText = `${format(dateRange.from, 'dd/MM/yyyy')} a ${format(dateRange.to, 'dd/MM/yyyy')}`;
    const showSales = productFilter === 'mais' || productFilter === 'menos';
    const rows = productReport.list.map((p, idx) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td>${p.name}</td>
        <td>${p.categoryName}</td>
        <td style="text-align:right;">R$ ${fmt(p.price)}</td>
        <td style="text-align:center;">${p.controlStock ? p.stock.toString().replace('.', ',') + ' ' + p.unit : '—'}</td>
        ${showSales ? `<td style="text-align:center;">${p.soldQty.toString().replace('.', ',')}</td><td style="text-align:right;">R$ ${fmt(p.soldTotal)}</td>` : ''}
      </tr>
    `).join('');
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Relatório de Produtos</title>
      <style>
        @page { size: A4; margin: 14mm; }
        body { font-family: Arial, sans-serif; color: #111; margin: 0; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        .meta { font-size: 11px; color: #555; margin-bottom: 12px; display:flex; justify-content:space-between; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        thead { background: #f0f0f0; }
        th, td { border: 1px solid #ccc; padding: 5px 6px; }
        th { text-align: left; font-weight: 600; }
        tfoot td { font-weight: 600; background: #fafafa; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style></head><body>
      <h1>Relatório de Produtos — ${productReport.title}</h1>
      <div class="meta">
        <span>Período: ${periodText}</span>
        <span>Emitido em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</span>
      </div>
      <table>
        <thead><tr>
          <th style="width:32px;">#</th>
          <th>Produto</th>
          <th>Categoria</th>
          <th style="width:80px;">Preço</th>
          <th style="width:80px;">Estoque</th>
          ${showSales ? '<th style="width:70px;">Vendidos</th><th style="width:90px;">Faturado</th>' : ''}
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="${showSales ? 7 : 5}" style="text-align:center;padding:20px;color:#666;">Sem produtos para os filtros selecionados.</td></tr>`}</tbody>
        <tfoot><tr><td colspan="${showSales ? 7 : 5}" style="text-align:right;">Total de itens: ${productReport.list.length}</td></tr></tfoot>
      </table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  const selectPreset = (key: PresetKey) => {
    setActivePreset(key);
    const preset = presets.find(p => p.key === key);
    if (preset) {
      const range = preset.getRange();
      setCustomRange({ from: range.from, to: range.to });
    }
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

  // Attendant sales calculation and aggregation
  const attendantStats = useMemo(() => {
    const attMap: Record<string, { id: string; name: string; commission: number }> = {};
    attendantsList.forEach(a => {
      attMap[a.id] = a;
      if (a.name) attMap[a.name.toLowerCase().trim()] = a;
    });

    const stats: Record<string, {
      id: string;
      name: string;
      commissionPct: number;
      totalSold: number;
      totalCommission: number;
      itemsCount: number;
      ordersSet: Set<string>;
      products: Record<string, { name: string; qty: number; total: number }>;
    }> = {};

    const getOrInit = (id: string, name: string) => {
      const registered = (id && attMap[id]) || (name && attMap[name.toLowerCase().trim()]);
      const key = id || (registered ? registered.id : name.toLowerCase().trim() || 'desconhecido');
      if (!stats[key]) {
        stats[key] = {
          id: key,
          name: registered?.name || name || 'Atendente não identificado',
          commissionPct: registered ? registered.commission : 0,
          totalSold: 0,
          totalCommission: 0,
          itemsCount: 0,
          ordersSet: new Set<string>(),
          products: {},
        };
      }
      return stats[key];
    };

    filteredSales.forEach(s => {
      const sOrder = orders.find(o => o.id === s.orderId);
      const fallbackOpenerId = sOrder?.openedBy;
      const fallbackOpenerName = sOrder?.openedByName;

      (s.items || []).forEach(item => {
        const attId = item.addedBy || fallbackOpenerId || '';
        const attName = item.addedByName || fallbackOpenerName || (attId && attMap[attId]?.name) || '';

        const entry = getOrInit(attId, attName);
        const subtotal = Number(item.subtotal ?? (item.price * item.quantity));
        const qty = Number(item.quantity || 1);

        entry.totalSold += subtotal;
        entry.itemsCount += qty;
        if (s.orderId) entry.ordersSet.add(s.orderId);

        const prodKey = item.productId || item.name;
        if (!entry.products[prodKey]) {
          entry.products[prodKey] = { name: item.name, qty: 0, total: 0 };
        }
        entry.products[prodKey].qty += qty;
        entry.products[prodKey].total += subtotal;
      });
    });

    // Also include registered attendants who had 0 sales in the period
    attendantsList.forEach(a => {
      if (!stats[a.id]) {
        stats[a.id] = {
          id: a.id,
          name: a.name,
          commissionPct: a.commission,
          totalSold: 0,
          totalCommission: 0,
          itemsCount: 0,
          ordersSet: new Set<string>(),
          products: {},
        };
      }
    });

    return Object.values(stats).map(entry => ({
      ...entry,
      ordersCount: entry.ordersSet.size,
      totalCommission: entry.commissionPct > 0 ? (entry.totalSold * entry.commissionPct) / 100 : 0,
      productsList: Object.values(entry.products).sort((a, b) => b.total - a.total),
    })).sort((a, b) => b.totalSold - a.totalSold);
  }, [filteredSales, orders, attendantsList]);

  const filteredAttendantStats = useMemo(() => {
    return attendantStats.filter(att => {
      if (selectedAttendantId !== 'all' && att.id !== selectedAttendantId) {
        return false;
      }
      if (attendantSearchQuery.trim()) {
        const query = attendantSearchQuery.toLowerCase().trim();
        if (!att.name.toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [attendantStats, selectedAttendantId, attendantSearchQuery]);

  const attendantKpis = useMemo(() => {
    const totalSold = filteredAttendantStats.reduce((sum, a) => sum + a.totalSold, 0);
    const totalCommission = filteredAttendantStats.reduce((sum, a) => sum + a.totalCommission, 0);
    const totalItems = filteredAttendantStats.reduce((sum, a) => sum + a.itemsCount, 0);
    const topSeller = filteredAttendantStats.find(a => a.totalSold > 0);
    return { totalSold, totalCommission, totalItems, topSeller };
  }, [filteredAttendantStats]);

  const handlePrintAttendants = (mode: 'print' | 'pdf' = 'print') => {
    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) {
      alert('Permita popups para imprimir ou gerar PDF.');
      return;
    }
    const periodText = rangeLabelText || `${format(dateRange.from, 'dd/MM/yyyy')} a ${format(dateRange.to, 'dd/MM/yyyy')}`;
    const storeName = printSettings?.storeName || 'IZYFOOD';
    const storeDoc = printSettings?.document ? `${printSettings.documentType?.toUpperCase() || 'DOC'}: ${printSettings.document}` : '';
    const storePhone = printSettings?.whatsapp ? `Tel: ${printSettings.whatsapp}` : '';

    const listToPrint = filteredAttendantStats;
    const totalGeralVendido = listToPrint.reduce((acc, a) => acc + a.totalSold, 0);
    const totalGeralComissao = listToPrint.reduce((acc, a) => acc + a.totalCommission, 0);
    const totalGeralItens = listToPrint.reduce((acc, a) => acc + a.itemsCount, 0);
    const totalGeralPedidos = listToPrint.reduce((acc, a) => acc + a.ordersCount, 0);

    const filterNameText = selectedAttendantId === 'all'
      ? (attendantSearchQuery ? `Busca: "${attendantSearchQuery}"` : 'Todos os Atendentes')
      : (attendantsList.find(a => a.id === selectedAttendantId)?.name || 'Atendente Selecionado');

    const docTitle = mode === 'pdf'
      ? `Relatorio_Vendas_Atendentes_${format(dateRange.from, 'dd-MM-yyyy')}_a_${format(dateRange.to, 'dd-MM-yyyy')}`
      : 'Relatório de Vendas por Atendente';

    const rows = listToPrint.map((att, idx) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td><strong>${att.name}</strong></td>
        <td style="text-align:center;">${att.ordersCount}</td>
        <td style="text-align:center;">${att.itemsCount}</td>
        <td style="text-align:right;">R$ ${fmt(att.totalSold)}</td>
        <td style="text-align:center;">${att.commissionPct}%</td>
        <td style="text-align:right;font-weight:bold;color:#166534;">R$ ${fmt(att.totalCommission)}</td>
        <td style="text-align:right;">R$ ${att.ordersCount > 0 ? fmt(att.totalSold / att.ordersCount) : '0,00'}</td>
      </tr>
      ${(selectedAttendantId !== 'all' || expandedAttendantId === att.id) && att.productsList.length > 0 ? `
        <tr>
          <td colspan="8" style="background:#f8fafc;padding:8px 12px;">
            <div style="font-size:10px;font-weight:bold;margin-bottom:4px;color:#475569;">PRODUTOS VENDIDOS POR ${att.name.toUpperCase()}:</div>
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
              <thead>
                <tr style="background:#e2e8f0;">
                  <th style="padding:4px 6px;text-align:left;">Produto</th>
                  <th style="padding:4px 6px;text-align:center;width:60px;">Qtd</th>
                  <th style="padding:4px 6px;text-align:right;width:80px;">Total (R$)</th>
                </tr>
              </thead>
              <tbody>
                ${att.productsList.map(p => `
                  <tr>
                    <td style="padding:3px 6px;border-bottom:1px solid #e2e8f0;">${p.name}</td>
                    <td style="padding:3px 6px;text-align:center;border-bottom:1px solid #e2e8f0;">${p.qty}</td>
                    <td style="padding:3px 6px;text-align:right;border-bottom:1px solid #e2e8f0;">R$ ${fmt(p.total)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </td>
        </tr>
      ` : ''}
    `).join('');

    win.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${docTitle}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 14mm 14mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.4;
      background: #fff;
    }
    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .store-info h1 {
      font-size: 18px;
      margin: 0 0 2px 0;
      color: #0f172a;
      font-weight: 800;
    }
    .store-info p {
      margin: 0;
      font-size: 10.5px;
      color: #64748b;
    }
    .report-badge {
      text-align: right;
    }
    .report-badge .badge-title {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 12px;
      font-size: 10.5px;
    }
    .meta-item .label {
      color: #64748b;
      font-size: 9px;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 1px;
    }
    .meta-item .value {
      font-weight: 600;
      color: #0f172a;
    }
    .kpi-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    .kpi-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      background: #ffffff;
    }
    .kpi-title {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 2px;
    }
    .kpi-value {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
    }
    .kpi-value.green {
      color: #166534;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      margin-bottom: 20px;
    }
    table.data-table th, table.data-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
    }
    table.data-table thead th {
      background: #f1f5f9;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 9.5px;
      color: #334155;
    }
    table.data-table tbody tr:nth-child(even) {
      background: #fafafa;
    }
    table.data-table tfoot td {
      background: #f1f5f9;
      font-weight: 700;
      border-top: 2px solid #0f172a;
    }
    .signatures {
      margin-top: 32px;
      display: flex;
      justify-content: space-around;
      page-break-inside: avoid;
    }
    .sign-box {
      width: 220px;
      text-align: center;
      font-size: 10px;
    }
    .sign-line {
      border-top: 1px solid #475569;
      margin-bottom: 4px;
    }
    .footer-note {
      margin-top: 16px;
      font-size: 9px;
      color: #94a3b8;
      text-align: center;
    }
    .no-print-bar {
      background: #0f172a;
      color: #fff;
      padding: 8px 14px;
      margin: -12mm -14mm 12px -14mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11.5px;
    }
    .no-print-bar button {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 5px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
    }
    @media print {
      .no-print-bar { display: none !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <span>${mode === 'pdf' ? '📄 Salvar como PDF: na caixa de diálogo de impressão, selecione "Salvar como PDF" como Destino.' : '🖨️ Pré-visualização de Impressão A4'}</span>
    <button onclick="window.print()">${mode === 'pdf' ? 'Salvar em PDF' : 'Imprimir Agora'}</button>
  </div>

  <div class="header">
    <div class="store-info">
      <h1>${storeName}</h1>
      <p>${[storeDoc, storePhone].filter(Boolean).join(' • ')}</p>
    </div>
    <div class="report-badge">
      <div class="badge-title">Vendas por Atendente</div>
      <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Relatório Analítico</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><div class="label">Período</div><div class="value">${periodText}</div></div>
    <div class="meta-item"><div class="label">Filtro Atendente</div><div class="value">${filterNameText}</div></div>
    <div class="meta-item"><div class="label">Data de Emissão</div><div class="value">${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</div></div>
    <div class="meta-item"><div class="label">Emitido Por</div><div class="value">${user?.name || 'Administrador'}</div></div>
  </div>

  <div class="kpi-cards">
    <div class="kpi-card"><div class="kpi-title">Total Vendido</div><div class="kpi-value">R$ ${fmt(totalGeralVendido)}</div></div>
    <div class="kpi-card"><div class="kpi-title">Total Comissões</div><div class="kpi-value green">R$ ${fmt(totalGeralComissao)}</div></div>
    <div class="kpi-card"><div class="kpi-title">Qtd. Itens Vendidos</div><div class="kpi-value">${totalGeralItens}</div></div>
    <div class="kpi-card"><div class="kpi-title">Pedidos Atendidos</div><div class="kpi-value">${totalGeralPedidos}</div></div>
  </div>

  <table class="data-table">
    <thead>
      <tr>
        <th style="width:28px;text-align:center;">#</th>
        <th>Atendente / Usuário</th>
        <th style="width:65px;text-align:center;">Pedidos</th>
        <th style="width:65px;text-align:center;">Itens</th>
        <th style="width:95px;text-align:right;">Total Vendido</th>
        <th style="width:50px;text-align:center;">% Com.</th>
        <th style="width:95px;text-align:right;">Comissão</th>
        <th style="width:85px;text-align:right;">Ticket Médio</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="8" style="text-align:center;padding:16px;color:#64748b;">Nenhuma venda encontrada para os filtros selecionados.</td></tr>'}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2" style="text-align:right;">TOTAIS:</td>
        <td style="text-align:center;">${totalGeralPedidos}</td>
        <td style="text-align:center;">${totalGeralItens}</td>
        <td style="text-align:right;">R$ ${fmt(totalGeralVendido)}</td>
        <td style="text-align:center;">—</td>
        <td style="text-align:right;color:#166534;">R$ ${fmt(totalGeralComissao)}</td>
        <td style="text-align:right;">R$ ${totalGeralPedidos > 0 ? fmt(totalGeralVendido / totalGeralPedidos) : '0,00'}</td>
      </tr>
    </tfoot>
  </table>

  <div class="signatures">
    <div class="sign-box"><div class="sign-line"></div><div>Administração / Responsável</div></div>
    <div class="sign-box"><div class="sign-line"></div><div>Conferência / Atendente</div></div>
  </div>

  <div class="footer-note">
    Documento gerado automaticamente pelo sistema de gestão em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss")}
  </div>
</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  const datePickerUI = (
    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 min-w-[200px] justify-start">
          <CalendarIcon className="h-4 w-4" />
          <span className="truncate">{rangeLabelText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex">
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
              modifiers={{
                range_start: customRange.from ? customRange.from : undefined,
                range_end: customRange.to ? customRange.to : undefined,
                range_middle: customRange.from && customRange.to
                  ? (date: Date) => isAfter(date, customRange.from!) && isBefore(date, customRange.to!) && !isSameDay(date, customRange.from!) && !isSameDay(date, customRange.to!)
                  : undefined,
              }}
              modifiersClassNames={{
                range_start: 'bg-primary text-primary-foreground rounded-l-md hover:bg-primary',
                range_end: 'bg-primary text-primary-foreground rounded-r-md hover:bg-primary',
                range_middle: 'bg-primary/15 text-foreground rounded-none',
              }}
              locale={ptBR}
              numberOfMonths={1}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        {datePickerUI}
      </div>

      <Tabs defaultValue="geral" className="space-y-4">
        <TabsList>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="clientes" className="gap-1.5">
            <Users className="h-4 w-4" /> Por Cliente
          </TabsTrigger>
          <TabsTrigger value="produtos" className="gap-1.5">
            <Package className="h-4 w-4" /> Produtos
          </TabsTrigger>
          <TabsTrigger value="atendentes" className="gap-1.5">
            <UserCheck className="h-4 w-4" /> Por Atendente
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-4 md:space-y-6">
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
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesByProduct.map(p => (
                          <TableRow key={p.name}>
                            <TableCell className="max-w-[180px] truncate" title={p.name}>{p.name}</TableCell>
                            <TableCell className="text-right">{p.qty}</TableCell>
                            <TableCell className="font-semibold text-right whitespace-nowrap">R$ {fmt(p.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : <p className="text-center text-muted-foreground py-8">Sem dados no período</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Clientes com Fiado</CardTitle></CardHeader>
              <CardContent>
                {creditCustomers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead className="text-right">Débito</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {creditCustomers.map(c => (
                          <TableRow key={c.id}>
                            <TableCell className="max-w-[160px] truncate" title={c.name}>{c.name}</TableCell>
                            <TableCell className="whitespace-nowrap">{c.phone}</TableCell>
                            <TableCell className="font-semibold text-destructive text-right whitespace-nowrap">R$ {fmt(c.creditBalance)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : <p className="text-center text-muted-foreground py-8">Nenhum fiado aberto</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="clientes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" /> Compras por Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customerStats.length > 0 ? (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="text-center">Compras</TableHead>
                      <TableHead className="text-center">Pontos</TableHead>
                      <TableHead className="text-right">Total Gasto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerStats.map(cs => (
                      <React.Fragment key={cs.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpandedCustomerId(prev => prev === cs.id ? null : cs.id)}
                        >
                          <TableCell className="w-8 px-2">
                            {expandedCustomerId === cs.id
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            }
                          </TableCell>
                          <TableCell className="font-medium">{cs.name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{cs.phone}</TableCell>
                          <TableCell className="text-center">{cs.count}</TableCell>
                          <TableCell className="text-center">
                            <span className="text-sm">⭐ {cs.loyaltyPoints}</span>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-primary">R$ {fmt(cs.total)}</TableCell>
                        </TableRow>
                        {expandedCustomerId === cs.id && (
                          <TableRow>
                            <TableCell colSpan={6} className="bg-muted/30 p-0">
                              <div className="p-4">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Produtos Comprados</p>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Produto</TableHead>
                                      <TableHead className="text-center">Qtd</TableHead>
                                      <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {cs.itemsList.map((item, idx) => (
                                      <TableRow key={idx}>
                                        <TableCell className="text-sm">{item.name}</TableCell>
                                        <TableCell className="text-center text-sm">
                                          {item.qty}
                                          {item.weightTotal > 0 && (
                                            <span className="text-xs text-muted-foreground ml-1">({(item.weightTotal).toFixed(2)}kg)</span>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-right text-sm font-medium">R$ {fmt(item.total)}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-12">Nenhuma venda vinculada a clientes no período selecionado</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="produtos" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" /> {productReport.title}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={productFilter} onValueChange={(v) => setProductFilter(v as typeof productFilter)}>
                    <SelectTrigger className="h-9 w-[180px]">
                      <SelectValue placeholder="Filtro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="categoria">Por Categoria</SelectItem>
                      <SelectItem value="baixo">Estoque Baixo</SelectItem>
                      <SelectItem value="mais">Mais Vendidos</SelectItem>
                      <SelectItem value="menos">Menos Vendidos</SelectItem>
                    </SelectContent>
                  </Select>
                  {productFilter === 'categoria' && (
                    <Select value={productCategoryId} onValueChange={setProductCategoryId}>
                      <SelectTrigger className="h-9 w-[180px]">
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {categories.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {productFilter === 'baixo' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">≤</span>
                      <input
                        type="number"
                        min={0}
                        value={lowStockThreshold}
                        onChange={(e) => setLowStockThreshold(Math.max(0, Number(e.target.value) || 0))}
                        className="h-9 w-16 rounded-md border bg-background px-2 text-sm"
                      />
                    </div>
                  )}
                  <Button onClick={handlePrintProducts} variant="default" className="h-9 gap-1.5">
                    <Printer className="h-4 w-4" /> Imprimir A4
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {productReport.list.length > 0 ? (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="text-center">Estoque</TableHead>
                      {(productFilter === 'mais' || productFilter === 'menos') && (
                        <>
                          <TableHead className="text-center">Vendidos</TableHead>
                          <TableHead className="text-right">Faturado</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productReport.list.map((p, idx) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{p.categoryName}</TableCell>
                        <TableCell className="text-right">R$ {fmt(p.price)}</TableCell>
                        <TableCell className={`text-center ${p.controlStock && p.stock <= lowStockThreshold ? 'text-destructive font-semibold' : ''}`}>
                          {p.controlStock ? `${p.stock.toString().replace('.', ',')} ${p.unit}` : '—'}
                        </TableCell>
                        {(productFilter === 'mais' || productFilter === 'menos') && (
                          <>
                            <TableCell className="text-center">{p.soldQty.toString().replace('.', ',')}</TableCell>
                            <TableCell className="text-right font-semibold text-primary">R$ {fmt(p.soldTotal)}</TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-12">Sem produtos para os filtros selecionados</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="atendentes" className="space-y-4 md:space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <DollarSign className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Vendido</p>
                  <p className="text-lg md:text-xl font-bold text-foreground">R$ {fmt(attendantKpis.totalSold)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Comissões</p>
                  <p className="text-lg md:text-xl font-bold text-emerald-600 dark:text-emerald-400">R$ {fmt(attendantKpis.totalCommission)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <ShoppingBag className="h-5 w-5 md:h-6 md:w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Itens Vendidos</p>
                  <p className="text-lg md:text-xl font-bold text-foreground">{attendantKpis.totalItems}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                  <UserCheck className="h-5 w-5 md:h-6 md:w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Top Atendente</p>
                  <p className="text-sm md:text-base font-bold text-foreground truncate">
                    {attendantKpis.topSeller ? attendantKpis.topSeller.name : '—'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table Card with Filter & Export Buttons */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold">Vendas por Atendente</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Consulte as vendas, pedidos e comissões de cada atendente no período selecionado.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-44 sm:w-52">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome..."
                      value={attendantSearchQuery}
                      onChange={e => setAttendantSearchQuery(e.target.value)}
                      className="h-9 pl-8 text-xs"
                    />
                  </div>
                  <Select value={selectedAttendantId} onValueChange={setSelectedAttendantId}>
                    <SelectTrigger className="h-9 w-44 text-xs">
                      <SelectValue placeholder="Todos os Atendentes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Atendentes</SelectItem>
                      {attendantsList.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => handlePrintAttendants('print')} className="h-9 gap-1.5 text-xs">
                    <Printer className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Imprimir</span> A4
                  </Button>
                  <Button onClick={() => handlePrintAttendants('pdf')} variant="outline" className="h-9 gap-1.5 text-xs">
                    <Download className="h-3.5 w-3.5" />
                    Salvar PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredAttendantStats.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Atendente</TableHead>
                        <TableHead className="text-center">Pedidos</TableHead>
                        <TableHead className="text-center">Itens</TableHead>
                        <TableHead className="text-right">Total Vendido</TableHead>
                        <TableHead className="text-center">% Comissão</TableHead>
                        <TableHead className="text-right">Comissão</TableHead>
                        <TableHead className="w-24 text-center">Detalhes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAttendantStats.map((att, idx) => {
                        const isExpanded = expandedAttendantId === att.id;
                        return (
                          <React.Fragment key={att.id}>
                            <TableRow className="hover:bg-muted/40">
                              <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                              <TableCell className="font-semibold text-foreground">{att.name}</TableCell>
                              <TableCell className="text-center">{att.ordersCount}</TableCell>
                              <TableCell className="text-center">{att.itemsCount}</TableCell>
                              <TableCell className="text-right font-medium">R$ {fmt(att.totalSold)}</TableCell>
                              <TableCell className="text-center text-muted-foreground">{att.commissionPct}%</TableCell>
                              <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                                R$ {fmt(att.totalCommission)}
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs gap-1"
                                  onClick={() => setExpandedAttendantId(isExpanded ? null : att.id)}
                                >
                                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                  <span>{att.productsList.length}</span>
                                </Button>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow className="bg-muted/20 hover:bg-muted/30">
                                <TableCell colSpan={8} className="p-3">
                                  <div className="rounded-lg border bg-background p-3 space-y-2">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                      Itens vendidos por {att.name}:
                                    </p>
                                    {att.productsList.length > 0 ? (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                        {att.productsList.map((p, pIdx) => (
                                          <div key={pIdx} className="flex justify-between items-center bg-muted/40 rounded px-2.5 py-1.5 border">
                                            <span className="font-medium text-foreground truncate mr-2">{p.name}</span>
                                            <span className="text-muted-foreground shrink-0 font-mono">
                                              {p.qty}x · <strong className="text-foreground">R$ {fmt(p.total)}</strong>
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-muted-foreground italic">Nenhum item vendido no período.</p>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-12">
                  Nenhum atendente encontrado para os filtros selecionados.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Relatorios;
