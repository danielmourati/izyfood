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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CreditCard, Loader2, Ban, PlayCircle, Gift, Receipt } from 'lucide-react';
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
  trial: 'Trial',
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
  pending_payment: 'Aguardando pagto',
  suspended: 'Suspenso',
};

export function PlanosPage() {
  const [rows, setRows] = useState<TenantPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [courtesyRow, setCourtesyRow] = useState<TenantPlanRow | null>(null);
  const [courtesyDays, setCourtesyDays] = useState('7');
  const [payments, setPayments] = useState<Record<string, Payment[]>>({});
  const [paymentsRow, setPaymentsRow] = useState<TenantPlanRow | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tenant_plans' as any)
      .select('id, tenant_id, plan, status, trial_ends_at, current_period_end, last_payment_at, tenants(name, slug, active)')
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
    }
    setRows((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (id: string, status: PlanStatus) => {
    const { error } = await supabase.from('tenant_plans' as any).update({ status }).eq('id', id);
    if (error) { toast.error('Erro ao atualizar status'); return; }
    fetchData();
  };

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
    if (error) { toast.error('Erro ao atualizar plano'); return; }
    fetchData();
  };

  const applyCourtesy = async () => {
    if (!courtesyRow) return;
    const days = parseInt(courtesyDays, 10);
    if (!days || days < 1) { toast.error('Informe um número de dias válido'); return; }
    const base = courtesyRow.trial_ends_at && new Date(courtesyRow.trial_ends_at) > new Date()
      ? new Date(courtesyRow.trial_ends_at)
      : new Date();
    const newEnd = new Date(base.getTime() + days * 864e5).toISOString();
    const { error } = await supabase.from('tenant_plans' as any).update({
      trial_ends_at: newEnd,
      status: 'active',
      plan: 'trial',
    }).eq('id', courtesyRow.id);
    if (error) { toast.error('Erro ao aplicar cortesia'); return; }
    setCourtesyRow(null);
    fetchData();
  };

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

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <CreditCard className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-heading font-bold text-foreground">Planos & Licenças</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground">Em Trial</p>
          <p className="text-2xl font-bold">{rows.filter(r => r.plan === 'trial').length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground">PRO Ativos</p>
          <p className="text-2xl font-bold text-success">
            {rows.filter(r => r.plan !== 'trial' && r.status === 'active').length}
          </p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground">Suspensos</p>
          <p className="text-2xl font-bold text-destructive">
            {rows.filter(r => r.status === 'suspended').length}
          </p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground">Expirados</p>
          <p className="text-2xl font-bold text-destructive">
            {rows.filter(r => r.status === 'expired').length}
          </p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Todos os planos</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum plano encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Tenant</th>
                    <th className="py-2 pr-4">Plano</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Trial até</th>
                    <th className="py-2 pr-4">Renovação</th>
                    <th className="py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-foreground">{r.tenants?.name || '—'}</p>
                        <p className="text-xs text-muted-foreground font-mono">{r.tenants?.slug}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <Select value={r.plan} onValueChange={(v) => updatePlan(r.id, v as PlanType)}>
                          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="trial">Trial</SelectItem>
                            <SelectItem value="pro_monthly">PRO Mensal</SelectItem>
                            <SelectItem value="pro_yearly">PRO Anual</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={statusVariant[r.status]}>{statusLabel[r.status]}</Badge>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{fmtDate(r.trial_ends_at)}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{fmtDate(r.current_period_end)}</td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          {r.status === 'suspended' ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" onClick={() => updateStatus(r.id, 'active')}>
                                  <PlayCircle className="h-4 w-4 text-success" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Reativar tenant</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" onClick={() => updateStatus(r.id, 'suspended')}>
                                  <Ban className="h-4 w-4 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Suspender tenant</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" onClick={() => { setCourtesyRow(r); setCourtesyDays('7'); }}>
                                <Gift className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Estender cortesia</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" onClick={() => openPayments(r)}>
                                <Receipt className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Pagamentos MP</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Courtesy modal */}
      <Dialog open={!!courtesyRow} onOpenChange={(v) => !v && setCourtesyRow(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Estender cortesia</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tenant: <strong>{courtesyRow?.tenants?.name}</strong>
          </p>
          <p className="text-xs text-muted-foreground">
            Trial atual até: {fmtDate(courtesyRow?.trial_ends_at ?? null)}
          </p>
          <div className="space-y-2">
            <Label>Dias adicionais</Label>
            <Input type="number" min="1" value={courtesyDays} onChange={e => setCourtesyDays(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCourtesyRow(null)}>Cancelar</Button>
            <Button onClick={applyCourtesy}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payments modal */}
      <Dialog open={!!paymentsRow} onOpenChange={(v) => !v && setPaymentsRow(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pagamentos MP · {paymentsRow?.tenants?.name}</DialogTitle>
          </DialogHeader>
          {paymentsRow && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground text-xs">
                    <th className="py-2 pr-3">Criado</th>
                    <th className="py-2 pr-3">Plano</th>
                    <th className="py-2 pr-3">Valor</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Pago em</th>
                    <th className="py-2">MP ID</th>
                  </tr>
                </thead>
                <tbody>
                  {(payments[paymentsRow.tenant_id] || []).map(p => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{fmtDateTime(p.created_at)}</td>
                      <td className="py-2 pr-3">{p.plan}</td>
                      <td className="py-2 pr-3 font-medium">{fmtBRL(Number(p.amount))}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={p.status === 'approved' || p.status === 'paid' ? 'default' : 'secondary'}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{fmtDateTime(p.paid_at)}</td>
                      <td className="py-2 font-mono text-xs">{p.mp_payment_id || '—'}</td>
                    </tr>
                  ))}
                  {(payments[paymentsRow.tenant_id] || []).length === 0 && (
                    <tr><td colSpan={6} className="py-4 text-center text-muted-foreground text-sm">Nenhum pagamento registrado.</td></tr>
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
