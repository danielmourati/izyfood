import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CreditCard, Loader2, Ban, PlayCircle, Gift, Receipt, Search,
  Calendar, Clock, SlidersHorizontal, AlertTriangle, CheckCircle2,
  Sparkles, RefreshCw, Infinity as InfinityIcon
} from 'lucide-react';
import { toast } from 'sonner';

type PlanType = 'trial' | 'pro_monthly' | 'pro_yearly';
type PlanStatus = 'active' | 'expired' | 'canceled' | 'pending_payment' | 'suspended';

interface TenantPlanRow {
  id: string;
  tenant_id: string;
  plan: PlanType;
  status: PlanStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  last_payment_at: string | null;
  tenants: { name: string; slug: string; active: boolean } | null;
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  plan: string;
  mp_payment_id: string | null;
}

const planLabels: Record<PlanType, string> = {
  trial: 'Trial (Teste)',
  pro_monthly: 'PRO Mensal',
  pro_yearly: 'PRO Anual',
};

const statusVariant: Record<PlanStatus, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  active: 'default',
  expired: 'destructive',
  canceled: 'secondary',
  pending_payment: 'outline',
  suspended: 'destructive',
};

const statusLabel: Record<PlanStatus, string> = {
  active: 'Ativo',
  expired: 'Expirado',
  canceled: 'Cancelado',
  pending_payment: 'Aguardando Pagamento',
  suspended: 'Suspenso',
};

// Returns relative expiration information in days
function getExpirationInfo(row: TenantPlanRow): {
  daysLeft: number | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
  isLifetime: boolean;
  displayDate: string;
  badgeText: string;
} {
  const targetDateStr = row.plan === 'trial' ? row.trial_ends_at : row.current_period_end;
  if (!targetDateStr) {
    return {
      daysLeft: null,
      isExpired: false,
      isExpiringSoon: false,
      isLifetime: false,
      displayDate: 'Sem data',
      badgeText: 'Não definida',
    };
  }

  const targetDate = new Date(targetDateStr);
  if (isNaN(targetDate.getTime())) {
    return {
      daysLeft: null,
      isExpired: false,
      isExpiringSoon: false,
      isLifetime: false,
      displayDate: 'Data inválida',
      badgeText: 'Inválida',
    };
  }

  if (targetDate.getFullYear() >= 2090) {
    return {
      daysLeft: 99999,
      isExpired: false,
      isExpiringSoon: false,
      isLifetime: true,
      displayDate: 'Vitalício',
      badgeText: 'Vitalício',
    };
  }

  const now = new Date();
  const diffTime = targetDate.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const isExpired = daysLeft < 0;
  const isExpiringSoon = daysLeft >= 0 && daysLeft <= 7;
  const displayDate = targetDate.toLocaleDateString('pt-BR');

  let badgeText = '';
  if (daysLeft === 0) badgeText = 'Vence HOJE';
  else if (daysLeft === 1) badgeText = 'Vence amanhã';
  else if (daysLeft > 1) badgeText = `em ${daysLeft} dias`;
  else badgeText = `Expirou há ${Math.abs(daysLeft)}d`;

  return { daysLeft, isExpired, isExpiringSoon, isLifetime: false, displayDate, badgeText };
}

export function PlanosPage() {
  const [rows, setRows] = useState<TenantPlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPlan, setFilterPlan] = useState<string>('all');

  // Quick extension / courtesy modal
  const [quickRow, setQuickRow] = useState<TenantPlanRow | null>(null);
  const [customDate, setCustomDate] = useState('');
  const [applyingQuick, setApplyingQuick] = useState(false);

  // Full edit plan modal
  const [editRow, setEditRow] = useState<TenantPlanRow | null>(null);
  const [editForm, setEditForm] = useState<{
    plan: PlanType;
    status: PlanStatus;
    trial_ends_at: string;
    current_period_end: string;
    last_payment_at: string;
  }>({
    plan: 'pro_monthly',
    status: 'active',
    trial_ends_at: '',
    current_period_end: '',
    last_payment_at: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Payments modal
  const [payments, setPayments] = useState<Record<string, Payment[]>>({});
  const [paymentsRow, setPaymentsRow] = useState<TenantPlanRow | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tenant_plans' as any)
      .select('id, tenant_id, plan, status, trial_ends_at, current_period_end, last_payment_at, tenants(name, slug, active)')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Erro ao buscar planos:', error);
      toast.error('Erro ao carregar planos');
    }
    setRows((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Inline status update
  const updateStatus = async (id: string, status: PlanStatus) => {
    const { error } = await supabase.from('tenant_plans' as any).update({ status }).eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar status do plano');
      return;
    }
    toast.success(`Status alterado para: ${statusLabel[status]}`);
    fetchData();
  };

  // Inline plan update
  const updatePlan = async (id: string, plan: PlanType) => {
    const patch: any = { plan };
    if (plan === 'pro_monthly') {
      patch.status = 'active';
      patch.current_period_end = new Date(Date.now() + 30 * 864e5).toISOString();
      patch.last_payment_at = new Date().toISOString();
    } else if (plan === 'pro_yearly') {
      patch.status = 'active';
      patch.current_period_end = new Date(Date.now() + 365 * 864e5).toISOString();
      patch.last_payment_at = new Date().toISOString();
    } else {
      patch.status = 'active';
      patch.trial_ends_at = new Date(Date.now() + 14 * 864e5).toISOString();
      patch.current_period_end = null;
    }
    const { error } = await supabase.from('tenant_plans' as any).update(patch).eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar plano');
      return;
    }
    toast.success(`Plano atualizado para: ${planLabels[plan]}`);
    fetchData();
  };

  // Quick date extension handlers
  const openQuickModal = (row: TenantPlanRow) => {
    setQuickRow(row);
    const target = row.plan === 'trial' ? row.trial_ends_at : row.current_period_end;
    if (target) {
      const d = new Date(target);
      if (!isNaN(d.getTime())) {
        setCustomDate(d.toISOString().slice(0, 10));
      } else {
        setCustomDate('');
      }
    } else {
      setCustomDate('');
    }
  };

  const applyQuickDays = async (days: number) => {
    if (!quickRow) return;
    setApplyingQuick(true);
    try {
      const currentTarget = quickRow.plan === 'trial' ? quickRow.trial_ends_at : quickRow.current_period_end;
      const base = currentTarget && new Date(currentTarget) > new Date()
        ? new Date(currentTarget)
        : new Date();

      const newDate = new Date(base.getTime() + days * 864e5).toISOString();
      const patch: any = { status: 'active' };

      if (quickRow.plan === 'trial') {
        patch.trial_ends_at = newDate;
      } else {
        patch.current_period_end = newDate;
      }

      const { error } = await supabase.from('tenant_plans' as any).update(patch).eq('id', quickRow.id);
      if (error) throw error;

      toast.success(`Adicionados +${days} dias para ${quickRow.tenants?.name}!`);
      setQuickRow(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao aplicar extensão de dias');
    } finally {
      setApplyingQuick(false);
    }
  };

  const applyLifetime = async () => {
    if (!quickRow) return;
    setApplyingQuick(true);
    try {
      const lifetimeDate = new Date('2099-12-31T23:59:59Z').toISOString();
      const patch: any = {
        status: 'active',
        plan: quickRow.plan === 'trial' ? 'pro_yearly' : quickRow.plan,
        current_period_end: lifetimeDate,
        last_payment_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('tenant_plans' as any).update(patch).eq('id', quickRow.id);
      if (error) throw error;
      toast.success(`Plano Vitalício definido para ${quickRow.tenants?.name}!`);
      setQuickRow(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao aplicar plano vitalício');
    } finally {
      setApplyingQuick(false);
    }
  };

  const applyCustomDate = async () => {
    if (!quickRow || !customDate) {
      toast.error('Selecione uma data válida');
      return;
    }
    setApplyingQuick(true);
    try {
      const selected = new Date(`${customDate}T23:59:59Z`).toISOString();
      const patch: any = { status: 'active' };
      if (quickRow.plan === 'trial') {
        patch.trial_ends_at = selected;
      } else {
        patch.current_period_end = selected;
      }
      const { error } = await supabase.from('tenant_plans' as any).update(patch).eq('id', quickRow.id);
      if (error) throw error;
      toast.success(`Data atualizada para ${new Date(selected).toLocaleDateString('pt-BR')}!`);
      setQuickRow(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao definir data');
    } finally {
      setApplyingQuick(false);
    }
  };

  // Full edit modal handlers
  const openEditModal = (row: TenantPlanRow) => {
    setEditRow(row);
    setEditForm({
      plan: row.plan,
      status: row.status,
      trial_ends_at: row.trial_ends_at ? row.trial_ends_at.slice(0, 10) : '',
      current_period_end: row.current_period_end ? row.current_period_end.slice(0, 10) : '',
      last_payment_at: row.last_payment_at ? row.last_payment_at.slice(0, 10) : '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editRow) return;
    setSavingEdit(true);
    try {
      const patch: any = {
        plan: editForm.plan,
        status: editForm.status,
        trial_ends_at: editForm.trial_ends_at ? new Date(`${editForm.trial_ends_at}T23:59:59Z`).toISOString() : null,
        current_period_end: editForm.current_period_end ? new Date(`${editForm.current_period_end}T23:59:59Z`).toISOString() : null,
        last_payment_at: editForm.last_payment_at ? new Date(`${editForm.last_payment_at}T12:00:00Z`).toISOString() : null,
      };

      const { error } = await supabase.from('tenant_plans' as any).update(patch).eq('id', editRow.id);
      if (error) throw error;

      toast.success(`Assinatura de ${editRow.tenants?.name} atualizada com sucesso!`);
      setEditRow(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar alterações da assinatura');
    } finally {
      setSavingEdit(false);
    }
  };

  // Payments modal
  const openPayments = async (row: TenantPlanRow) => {
    setPaymentsRow(row);
    if (!payments[row.tenant_id]) {
      const { data } = await supabase
        .from('payment_intents' as any)
        .select('id, amount, status, paid_at, created_at, plan, mp_payment_id')
        .eq('tenant_id', row.tenant_id)
        .order('created_at', { ascending: false })
        .limit(20);
      setPayments(prev => ({ ...prev, [row.tenant_id]: (data as any) || [] }));
    }
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
  const fmtDateTime = (d: string | null) => d ? new Date(d).toLocaleString('pt-BR') : '—';
  const fmtBRL = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  // Filtered rows
  const filteredRows = rows.filter(r => {
    const q = search.trim().toLowerCase();
    const name = r.tenants?.name?.toLowerCase() || '';
    const slug = r.tenants?.slug?.toLowerCase() || '';
    const matchesSearch = !q || name.includes(q) || slug.includes(q);

    const matchesPlan = filterPlan === 'all' || r.plan === filterPlan;

    let matchesStatus = true;
    if (filterStatus !== 'all') {
      if (filterStatus === 'expiring_soon') {
        const info = getExpirationInfo(r);
        matchesStatus = info.isExpiringSoon && !info.isExpired;
      } else {
        matchesStatus = r.status === filterStatus;
      }
    }

    return matchesSearch && matchesPlan && matchesStatus;
  });

  // Metric stats
  const totalLicencas = rows.length;
  const trialCount = rows.filter(r => r.plan === 'trial').length;
  const proAtivosCount = rows.filter(r => r.plan !== 'trial' && r.status === 'active').length;
  const expiringSoonCount = rows.filter(r => {
    const info = getExpirationInfo(r);
    return info.isExpiringSoon && !info.isExpired && r.status === 'active';
  }).length;
  const suspensosCount = rows.filter(r => r.status === 'suspended').length;
  const expiradosCount = rows.filter(r => r.status === 'expired').length;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Controle de Planos & Licenças</h1>
            <p className="text-xs text-muted-foreground">
              Supervisão total de assinaturas, vigências, cortesias e status de cada estabelecimento.
            </p>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-1.5 self-start sm:self-auto">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Total Estabelecimentos</p>
          <p className="text-2xl font-bold text-foreground mt-1">{totalLicencas}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Em Período de Teste</p>
          <p className="text-2xl font-bold text-primary mt-1">{trialCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Planos PRO Ativos</p>
          <p className="text-2xl font-bold text-success mt-1">{proAtivosCount}</p>
        </Card>
        <Card className="p-4 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Vencendo em Breve</p>
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{expiringSoonCount}</p>
        </Card>
        <Card className="p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-muted-foreground font-medium">Suspensos / Expirados</p>
          <p className="text-2xl font-bold text-destructive mt-1">{suspensosCount + expiradosCount}</p>
        </Card>
      </div>

      {/* Table Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-base font-semibold">Todas as Assinaturas & Licenças</CardTitle>
            <span className="text-xs text-muted-foreground font-mono">
              Exibindo {filteredRows.length} de {rows.length}
            </span>
          </div>

          {/* Search & Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou slug do tenant..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="expiring_soon">⚠️ Vencendo em breve (&le; 7 dias)</SelectItem>
                <SelectItem value="suspended">Suspenso</SelectItem>
                <SelectItem value="expired">Expirado</SelectItem>
                <SelectItem value="pending_payment">Aguardando Pagamento</SelectItem>
                <SelectItem value="canceled">Cancelado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterPlan} onValueChange={setFilterPlan}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por Tipo de Plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Planos</SelectItem>
                <SelectItem value="trial">Trial (Teste)</SelectItem>
                <SelectItem value="pro_monthly">PRO Mensal</SelectItem>
                <SelectItem value="pro_yearly">PRO Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="space-y-3 py-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="font-medium">Nenhum plano encontrado com os filtros atuais.</p>
              <p className="text-xs mt-1">Tente remover os termos de busca ou mudar os filtros.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="py-2.5 pr-4">Estabelecimento</th>
                    <th className="py-2.5 pr-4">Plano Atual</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 pr-4">Trial até</th>
                    <th className="py-2.5 pr-4">Renovação / Vigência</th>
                    <th className="py-2.5 text-right">Ações SuperAdmin</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(r => {
                    const expInfo = getExpirationInfo(r);
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                        {/* Tenant */}
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-semibold text-foreground leading-tight">
                                {r.tenants?.name || '—'}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono">
                                /{r.tenants?.slug}
                              </p>
                            </div>
                            {r.tenants?.active === false && (
                              <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                Loja Desativada
                              </Badge>
                            )}
                          </div>
                        </td>

                        {/* Plan selection */}
                        <td className="py-3 pr-4">
                          <Select value={r.plan} onValueChange={(v) => updatePlan(r.id, v as PlanType)}>
                            <SelectTrigger className="h-8 w-36 text-xs font-medium">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="trial">Trial</SelectItem>
                              <SelectItem value="pro_monthly">PRO Mensal</SelectItem>
                              <SelectItem value="pro_yearly">PRO Anual</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>

                        {/* Status selection */}
                        <td className="py-3 pr-4">
                          <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v as PlanStatus)}>
                            <SelectTrigger className="h-8 w-36 text-xs font-medium">
                              <SelectValue>
                                <span className="flex items-center gap-1.5">
                                  <span className={`h-2 w-2 rounded-full ${
                                    r.status === 'active' ? 'bg-success' :
                                    r.status === 'suspended' ? 'bg-destructive' :
                                    r.status === 'expired' ? 'bg-destructive' :
                                    r.status === 'pending_payment' ? 'bg-amber-500' : 'bg-muted-foreground'
                                  }`} />
                                  {statusLabel[r.status] || r.status}
                                </span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Ativo</SelectItem>
                              <SelectItem value="suspended">Suspenso</SelectItem>
                              <SelectItem value="expired">Expirado</SelectItem>
                              <SelectItem value="pending_payment">Aguardando Pagamento</SelectItem>
                              <SelectItem value="canceled">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>

                        {/* Trial Date */}
                        <td className="py-3 pr-4 text-muted-foreground text-xs">
                          {fmtDate(r.trial_ends_at)}
                        </td>

                        {/* Renewal Date with countdown */}
                        <td className="py-3 pr-4">
                          <div className="space-y-0.5">
                            <p className="text-xs font-medium text-foreground">
                              {r.plan === 'trial' ? fmtDate(r.trial_ends_at) : fmtDate(r.current_period_end)}
                            </p>
                            {expInfo.isLifetime ? (
                              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 gap-1 px-1.5 py-0">
                                <InfinityIcon className="h-3 w-3" /> Vitalício
                              </Badge>
                            ) : expInfo.isExpiringSoon && !expInfo.isExpired ? (
                              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-medium px-1.5 py-0">
                                ⚠️ {expInfo.badgeText}
                              </Badge>
                            ) : expInfo.isExpired ? (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                {expInfo.badgeText}
                              </Badge>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">
                                {expInfo.badgeText}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* SuperAdmin Actions */}
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Full edit modal button */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                                  onClick={() => openEditModal(r)}
                                >
                                  <SlidersHorizontal className="h-3.5 w-3.5" />
                                  <span className="hidden lg:inline">Gerenciar</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Controle total da assinatura (datas, plano, pagamentos)</TooltipContent>
                            </Tooltip>

                            {/* Quick Extension / Courtesy */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                                  onClick={() => openQuickModal(r)}
                                >
                                  <Gift className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Adicionar dias / Estender vigência / Vitalício</TooltipContent>
                            </Tooltip>

                            {/* Suspend or Activate toggle */}
                            {r.status === 'suspended' ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-success hover:bg-success/10"
                                    onClick={() => updateStatus(r.id, 'active')}
                                  >
                                    <PlayCircle className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Reativar estabelecimento</TooltipContent>
                              </Tooltip>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                    onClick={() => updateStatus(r.id, 'suspended')}
                                  >
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Suspender estabelecimento</TooltipContent>
                              </Tooltip>
                            )}

                            {/* MP Payments history */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => openPayments(r)}
                                >
                                  <Receipt className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ver histórico de pagamentos Mercado Pago</TooltipContent>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL 1: Quick Extension & Courtesy */}
      <Dialog open={!!quickRow} onOpenChange={(v) => !v && setQuickRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-amber-500" />
              Estender Vigência / Cortesia
            </DialogTitle>
            <DialogDescription>
              Adicione dias ao plano de <strong>{quickRow?.tenants?.name}</strong> com apenas um clique.
            </DialogDescription>
          </DialogHeader>

          {quickRow && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-muted/60 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plano Atual:</span>
                  <span className="font-semibold">{planLabels[quickRow.plan]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status Atual:</span>
                  <Badge variant={statusVariant[quickRow.status]}>{statusLabel[quickRow.status]}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vencimento Atual:</span>
                  <span className="font-medium text-foreground">
                    {quickRow.plan === 'trial' ? fmtDate(quickRow.trial_ends_at) : fmtDate(quickRow.current_period_end)}
                  </span>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Extensões Rápidas:
                </Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={applyingQuick}
                    onClick={() => applyQuickDays(7)}
                    className="text-xs"
                  >
                    +7 dias
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={applyingQuick}
                    onClick={() => applyQuickDays(15)}
                    className="text-xs"
                  >
                    +15 dias
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={applyingQuick}
                    onClick={() => applyQuickDays(30)}
                    className="text-xs font-medium border-primary/30 text-primary hover:bg-primary/10"
                  >
                    +30 dias (1 mês)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={applyingQuick}
                    onClick={() => applyQuickDays(60)}
                    className="text-xs"
                  >
                    +60 dias (2 meses)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={applyingQuick}
                    onClick={() => applyQuickDays(90)}
                    className="text-xs"
                  >
                    +90 dias (3 meses)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={applyingQuick}
                    onClick={() => applyQuickDays(365)}
                    className="text-xs font-medium text-success border-success/30 hover:bg-success/10"
                  >
                    +1 ano (365d)
                  </Button>
                </div>
              </div>

              <div className="pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 text-xs border-primary/40 bg-primary/5 hover:bg-primary/15 text-primary"
                  disabled={applyingQuick}
                  onClick={applyLifetime}
                >
                  <Sparkles className="h-4 w-4" /> Conceder Plano Vitalício (Ano 2099)
                </Button>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="custom-end" className="text-xs font-semibold">
                  Ou defina uma data exata:
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="custom-end"
                    type="date"
                    value={customDate}
                    onChange={e => setCustomDate(e.target.value)}
                    className="text-sm font-mono"
                  />
                  <Button onClick={applyCustomDate} disabled={applyingQuick || !customDate} size="sm">
                    {applyingQuick ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar Data'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setQuickRow(null)} disabled={applyingQuick}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Full Plan Management */}
      <Dialog open={!!editRow} onOpenChange={(v) => !v && setEditRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              Gestão Completa da Assinatura
            </DialogTitle>
            <DialogDescription>
              Configuração manual de todos os parâmetros da licença de <strong>{editRow?.tenants?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          {editRow && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo de Plano</Label>
                  <Select value={editForm.plan} onValueChange={(v) => setEditForm(f => ({ ...f, plan: v as PlanType }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial (Teste)</SelectItem>
                      <SelectItem value="pro_monthly">PRO Mensal</SelectItem>
                      <SelectItem value="pro_yearly">PRO Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Status da Assinatura</Label>
                  <Select value={editForm.status} onValueChange={(v) => setEditForm(f => ({ ...f, status: v as PlanStatus }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="suspended">Suspenso</SelectItem>
                      <SelectItem value="expired">Expirado</SelectItem>
                      <SelectItem value="pending_payment">Aguardando Pagamento</SelectItem>
                      <SelectItem value="canceled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="period-end">Data de Vencimento / Renovação (PRO)</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-primary px-1.5"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 30);
                      setEditForm(f => ({ ...f, current_period_end: d.toISOString().slice(0, 10) }));
                    }}
                  >
                    +30 dias
                  </Button>
                </div>
                <Input
                  id="period-end"
                  type="date"
                  value={editForm.current_period_end}
                  onChange={e => setEditForm(f => ({ ...f, current_period_end: e.target.value }))}
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="trial-end">Data de Fim do Trial</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-primary px-1.5"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 14);
                      setEditForm(f => ({ ...f, trial_ends_at: d.toISOString().slice(0, 10) }));
                    }}
                  >
                    +14 dias
                  </Button>
                </div>
                <Input
                  id="trial-end"
                  type="date"
                  value={editForm.trial_ends_at}
                  onChange={e => setEditForm(f => ({ ...f, trial_ends_at: e.target.value }))}
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="last-pay">Data do Último Pagamento</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-primary px-1.5"
                    onClick={() => {
                      setEditForm(f => ({ ...f, last_payment_at: new Date().toISOString().slice(0, 10) }));
                    }}
                  >
                    Hoje
                  </Button>
                </div>
                <Input
                  id="last-pay"
                  type="date"
                  value={editForm.last_payment_at}
                  onChange={e => setEditForm(f => ({ ...f, last_payment_at: e.target.value }))}
                  className="font-mono"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditRow(null)} disabled={savingEdit}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Payments modal */}
      <Dialog open={!!paymentsRow} onOpenChange={(v) => !v && setPaymentsRow(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Histórico de Pagamentos · {paymentsRow?.tenants?.name}
            </DialogTitle>
            <DialogDescription>
              Transações e tentativas de pagamento via Mercado Pago registradas para este estabelecimento.
            </DialogDescription>
          </DialogHeader>

          {paymentsRow && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="py-2.5 pr-3">Data/Hora</th>
                    <th className="py-2.5 pr-3">Plano</th>
                    <th className="py-2.5 pr-3">Valor</th>
                    <th className="py-2.5 pr-3">Status</th>
                    <th className="py-2.5 pr-3">Pago em</th>
                    <th className="py-2.5">ID Mercado Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {(payments[paymentsRow.tenant_id] || []).map(p => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground">{fmtDateTime(p.created_at)}</td>
                      <td className="py-2.5 pr-3 font-medium">{p.plan}</td>
                      <td className="py-2.5 pr-3 font-semibold text-foreground">{fmtBRL(Number(p.amount))}</td>
                      <td className="py-2.5 pr-3">
                        <Badge variant={p.status === 'approved' || p.status === 'paid' ? 'default' : 'secondary'}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground">{fmtDateTime(p.paid_at)}</td>
                      <td className="py-2.5 font-mono text-xs">{p.mp_payment_id || '—'}</td>
                    </tr>
                  ))}
                  {(payments[paymentsRow.tenant_id] || []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">
                        Nenhum pagamento registrado no Mercado Pago para este estabelecimento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
