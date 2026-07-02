import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type PlanType = 'trial' | 'pro_monthly' | 'pro_yearly';
type PlanStatus = 'active' | 'expired' | 'canceled' | 'pending_payment';

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
};

const statusLabel: Record<PlanStatus, string> = {
  active: 'Ativo',
  expired: 'Expirado',
  canceled: 'Cancelado',
  pending_payment: 'Aguardando pagto',
};

export function PlanosPage() {
  const [rows, setRows] = useState<TenantPlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tenant_plans' as any)
      .select('id, tenant_id, plan, status, trial_ends_at, current_period_end, last_payment_at, tenants(name, slug, active)')
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      toast.error('Erro ao carregar planos');
    }
    setRows((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updatePlan = async (id: string, plan: PlanType) => {
    const patch: any = { plan };
    if (plan === 'pro_monthly') {
      patch.status = 'active';
      patch.current_period_end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      patch.last_payment_at = new Date().toISOString();
    } else if (plan === 'pro_yearly') {
      patch.status = 'active';
      patch.current_period_end = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      patch.last_payment_at = new Date().toISOString();
    } else {
      patch.status = 'active';
      patch.trial_ends_at = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      patch.current_period_end = null;
    }
    const { error } = await supabase.from('tenant_plans' as any).update(patch).eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar plano');
      return;
    }
    toast.success('Plano atualizado');
    fetchData();
  };

  const updateStatus = async (id: string, status: PlanStatus) => {
    const { error } = await supabase.from('tenant_plans' as any).update({ status }).eq('id', id);
    if (error) { toast.error('Erro ao atualizar status'); return; }
    toast.success('Status atualizado');
    fetchData();
  };

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('pt-BR') : '—';

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <CreditCard className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-heading font-bold text-foreground">Planos & Licenças</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Em Trial</p>
            <p className="text-2xl font-bold">{rows.filter(r => r.plan === 'trial').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">PRO Ativos</p>
            <p className="text-2xl font-bold text-success">
              {rows.filter(r => r.plan !== 'trial' && r.status === 'active').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Expirados</p>
            <p className="text-2xl font-bold text-destructive">
              {rows.filter(r => r.status === 'expired').length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Todos os planos</CardTitle>
        </CardHeader>
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
                        <Badge variant="secondary">{planLabels[r.plan]}</Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={statusVariant[r.status]}>{statusLabel[r.status]}</Badge>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{fmtDate(r.trial_ends_at)}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{fmtDate(r.current_period_end)}</td>
                      <td className="py-3 flex gap-2">
                        <Select value={r.plan} onValueChange={(v) => updatePlan(r.id, v as PlanType)}>
                          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="trial">Trial</SelectItem>
                            <SelectItem value="pro_monthly">PRO Mensal</SelectItem>
                            <SelectItem value="pro_yearly">PRO Anual</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v as PlanStatus)}>
                          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Ativo</SelectItem>
                            <SelectItem value="expired">Expirado</SelectItem>
                            <SelectItem value="canceled">Cancelado</SelectItem>
                            <SelectItem value="pending_payment">Aguardando</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preços de referência</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-border">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Trial</p>
            <p className="text-2xl font-heading font-bold mt-1">Grátis</p>
            <p className="text-xs text-muted-foreground mt-1">14 dias de acesso completo</p>
          </div>
          <div className="p-4 rounded-xl border-2 border-primary bg-primary/5">
            <p className="text-xs uppercase tracking-wider text-primary">PRO Mensal</p>
            <p className="text-2xl font-heading font-bold mt-1">R$ 157<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
            <p className="text-xs text-muted-foreground mt-1">Cobrança recorrente mensal</p>
          </div>
          <div className="p-4 rounded-xl border border-border">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">PRO Anual</p>
            <p className="text-2xl font-heading font-bold mt-1">R$ 1.570<span className="text-sm font-normal text-muted-foreground">/ano</span></p>
            <p className="text-xs text-success mt-1">Economize R$ 314 (2 meses grátis)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
