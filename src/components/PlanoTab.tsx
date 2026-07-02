import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Check, Loader2, Lock } from 'lucide-react';

type PlanType = 'trial' | 'pro_monthly' | 'pro_yearly';
type PlanStatus = 'active' | 'expired' | 'canceled' | 'pending_payment';

interface Plan {
  plan: PlanType;
  status: PlanStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

const planLabels: Record<PlanType, string> = {
  trial: 'Trial',
  pro_monthly: 'PRO Mensal',
  pro_yearly: 'PRO Anual',
};

export function PlanoTab() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.tenantId) return;
    (async () => {
      const { data } = await supabase
        .from('tenant_plans' as any)
        .select('plan, status, trial_ends_at, current_period_end')
        .eq('tenant_id', user.tenantId)
        .maybeSingle();
      setPlan((data as any) || null);
      setLoading(false);
    })();
  }, [user?.tenantId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando plano...
      </div>
    );
  }

  const isTrial = plan?.plan === 'trial';
  const isPro = plan && plan.plan !== 'trial' && plan.status === 'active';
  const trialEnds = plan?.trial_ends_at ? new Date(plan.trial_ends_at) : null;
  const now = new Date();
  const daysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const periodEnd = plan?.current_period_end ? new Date(plan.current_period_end) : null;

  return (
    <div className="space-y-4">
      {/* Current plan card */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Seu plano atual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-3xl font-heading font-bold text-foreground">
              {plan ? planLabels[plan.plan] : '—'}
            </span>
            <Badge variant={isPro ? 'default' : 'secondary'}>
              {isPro ? 'Ativo' : isTrial ? 'Período de teste' : plan?.status || '—'}
            </Badge>
          </div>

          {isTrial && (
            <p className="text-sm text-muted-foreground">
              Você tem <strong className="text-foreground">{daysLeft} {daysLeft === 1 ? 'dia' : 'dias'}</strong> restantes de teste gratuito.
              {trialEnds && (
                <> Expira em <strong>{trialEnds.toLocaleDateString('pt-BR')}</strong>.</>
              )}
            </p>
          )}

          {isPro && periodEnd && (
            <p className="text-sm text-muted-foreground">
              Próxima renovação em <strong className="text-foreground">{periodEnd.toLocaleDateString('pt-BR')}</strong>.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Plan comparison */}
      {!isPro && (
        <Card>
          <CardHeader>
            <CardTitle>Faça upgrade para o PRO</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl border-2 border-primary bg-primary/5 space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-primary font-semibold">PRO Mensal</p>
                <p className="text-3xl font-heading font-bold text-foreground mt-1">
                  R$ 157<span className="text-base font-normal text-muted-foreground">/mês</span>
                </p>
              </div>
              <ul className="space-y-1.5 text-sm text-foreground">
                <li className="flex gap-2"><Check className="h-4 w-4 text-success shrink-0 mt-0.5" /> Tenants, usuários e pedidos ilimitados</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-success shrink-0 mt-0.5" /> Impressão térmica Bluetooth</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-success shrink-0 mt-0.5" /> Relatórios e auditoria</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-success shrink-0 mt-0.5" /> Suporte prioritário</li>
              </ul>
              <Button className="w-full" disabled>
                <Lock className="h-4 w-4 mr-2" />
                Quero assinar (em breve)
              </Button>
            </div>

            <div className="p-5 rounded-xl border border-border space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">PRO Anual</p>
                <p className="text-3xl font-heading font-bold text-foreground mt-1">
                  R$ 1.570<span className="text-base font-normal text-muted-foreground">/ano</span>
                </p>
                <p className="text-xs text-success mt-1">Economize R$ 314 (2 meses grátis)</p>
              </div>
              <ul className="space-y-1.5 text-sm text-foreground">
                <li className="flex gap-2"><Check className="h-4 w-4 text-success shrink-0 mt-0.5" /> Tudo do PRO Mensal</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-success shrink-0 mt-0.5" /> 2 meses grátis</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-success shrink-0 mt-0.5" /> Preço travado por 12 meses</li>
              </ul>
              <Button variant="outline" className="w-full" disabled>
                <Lock className="h-4 w-4 mr-2" />
                Quero assinar (em breve)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Pagamento via PIX processado pelo Mercado Pago — disponível na próxima atualização.
      </p>
    </div>
  );
}
