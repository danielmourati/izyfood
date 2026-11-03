import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantNavigate } from '@/hooks/use-tenant-navigate';
import { decodePlanPricing } from '@/lib/plan-pricing';
import { AlertTriangle, CreditCard, QrCode, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BannerPlanRow {
  plan: 'trial' | 'pro_monthly' | 'pro_yearly';
  trial_ends_at: string | null;
  current_period_end: string | null;
  status: string;
  mp_customer_id?: string | null;
  monthly_price?: number | null;
  yearly_price?: number | null;
  monthly_discount_pct?: number | null;
  yearly_discount_pct?: number | null;
}

const planNames: Record<string, string> = {
  trial: 'Período de Teste (Trial)',
  pro_monthly: 'PRO Mensal',
  pro_yearly: 'PRO Anual',
};

export function TrialBanner() {
  const { user, isAdmin } = useAuth();
  const navigate = useTenantNavigate();
  const location = useLocation();
  const [plan, setPlan] = useState<BannerPlanRow | null>(null);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('plan-expiry-banner-dismissed') === '1');

  const fetchPlan = useCallback(async () => {
    if (!user?.tenantId || !isAdmin) return;
    let { data, error } = await supabase
      .from('tenant_plans' as any)
      .select('plan, trial_ends_at, current_period_end, status, mp_customer_id, monthly_price, yearly_price, monthly_discount_pct, yearly_discount_pct')
      .eq('tenant_id', user.tenantId)
      .maybeSingle();

    if (error) {
      const fb = await supabase
        .from('tenant_plans' as any)
        .select('plan, trial_ends_at, current_period_end, status, mp_customer_id')
        .eq('tenant_id', user.tenantId)
        .maybeSingle();
      data = fb.data;
    }

    setPlan((data as any) || null);
  }, [user?.tenantId, isAdmin]);

  useEffect(() => {
    void fetchPlan();
  }, [fetchPlan, location.pathname]);

  if (!isAdmin || !plan || dismissed) return null;

  const isTrial = plan.plan === 'trial';
  const targetDateStr = isTrial ? plan.trial_ends_at : plan.current_period_end;
  if (!targetDateStr) return null;

  const targetDate = new Date(targetDateStr);
  if (isNaN(targetDate.getTime())) return null;

  // Ignorar planos vitalícios
  if (targetDate.getFullYear() >= 2090) return null;

  // Comparar por dia no fuso local para detectar "vence hoje" com precisão
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetDayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
  const daysLeft = Math.round((targetDayStart - todayStart) / (1000 * 60 * 60 * 24));

  const isExpired = daysLeft < 0 || plan.status === 'expired' || plan.status === 'suspended';
  const isDueToday = daysLeft === 0;
  const isDueSoon = daysLeft > 0 && daysLeft <= 7;

  // Mostrar para trial ou sempre que estiver próximo do vencimento (<= 7 dias), vencendo hoje ou vencido
  if (!isTrial && !isDueSoon && !isDueToday && !isExpired) return null;

  const decoded = decodePlanPricing(plan);
  const effectiveAmount = plan.plan === 'pro_yearly'
    ? Math.round(decoded.yearly_price * (1 - decoded.yearly_discount_pct / 100) * 100) / 100
    : Math.round(decoded.monthly_price * (1 - decoded.monthly_discount_pct / 100) * 100) / 100;
  const formattedAmount = effectiveAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formattedDate = targetDate.toLocaleDateString('pt-BR');
  const label = planNames[plan.plan] || 'Plano PRO';

  const isUrgent = isExpired || isDueToday || daysLeft <= 3;

  const handlePayNow = () => {
    const targetPlan = plan.plan === 'pro_yearly' ? 'pro_yearly' : 'pro_monthly';
    navigate(`/configuracoes?tab=plano&pay=pix&plan=${targetPlan}&t=${Date.now()}`);
  };

  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center justify-between gap-2 px-3 md:px-4 py-2 border-b text-xs transition-colors shrink-0 ${
        isExpired || isDueToday
          ? 'bg-destructive/10 border-destructive/30 text-foreground'
          : isUrgent
          ? 'bg-amber-500/15 border-amber-500/30 text-foreground'
          : 'bg-primary/10 border-primary/20 text-foreground'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isUrgent ? (
          <AlertTriangle className={`h-4 w-4 shrink-0 ${isExpired || isDueToday ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`} />
        ) : (
          <CreditCard className="h-4 w-4 text-primary shrink-0" />
        )}

        <span className="leading-snug">
          {isExpired ? (
            <>
              Sua assinatura <strong>{label}</strong> venceu em <strong>{formattedDate}</strong> ({formattedAmount}). Regularize para evitar bloqueio.
            </>
          ) : isDueToday ? (
            <>
              Atenção: Sua assinatura <strong>{label}</strong> vence <strong>HOJE ({formattedDate})</strong> — Valor: <strong>{formattedAmount}</strong>.
            </>
          ) : isTrial ? (
            <>
              Você está no <strong>{label}</strong> — resta{daysLeft === 1 ? '' : 'm'} <strong>{daysLeft} {daysLeft === 1 ? 'dia' : 'dias'}</strong> (até {formattedDate}).
            </>
          ) : (
            <>
              Sua assinatura <strong>{label}</strong> vence em <strong>{daysLeft} {daysLeft === 1 ? 'dia' : 'dias'}</strong> ({formattedDate}) — Valor: <strong>{formattedAmount}</strong>.
            </>
          )}
        </span>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <Button
          size="sm"
          variant={isExpired || isDueToday ? 'destructive' : 'default'}
          className="h-7 px-3 text-xs font-semibold gap-1.5 shadow-sm"
          onClick={handlePayNow}
        >
          <QrCode className="h-3.5 w-3.5" />
          Pagar agora
        </Button>

        <button
          onClick={() => {
            setDismissed(true);
            sessionStorage.setItem('plan-expiry-banner-dismissed', '1');
          }}
          className="text-muted-foreground hover:text-foreground p-1 rounded"
          aria-label="Fechar aviso"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
