import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { decodePlanPricing } from '@/lib/plan-pricing';
import {
  CreditCard, Check, Loader2, Copy, CheckCircle2, XCircle,
  QrCode, Lock, Sparkles, ExternalLink, ShieldCheck, Gift, AlertTriangle
} from 'lucide-react';

type PlanType = 'trial' | 'pro_monthly' | 'pro_yearly';
type PlanStatus = 'active' | 'expired' | 'canceled' | 'pending_payment' | 'suspended';
type PayMode = 'pix' | 'card';

interface Plan {
  plan: PlanType;
  status: PlanStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  mp_customer_id?: string | null;
  monthly_price?: number | null;
  yearly_price?: number | null;
  monthly_discount_pct?: number | null;
  yearly_discount_pct?: number | null;
  courtesy_months?: number | null;
  max_installments?: number | null;
}

interface Intent {
  intent_id: string;
  qr_code?: string | null;
  qr_code_base64?: string | null;
  ticket_url?: string | null;
  checkout_url?: string | null;
  amount: number;
  expires_at?: string;
}

const planLabels: Record<PlanType, string> = {
  trial: 'Trial (Período de Teste)',
  pro_monthly: 'PRO Mensal',
  pro_yearly: 'PRO Anual',
};

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function PlanoTab() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);

  // Checkout Modal State
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'pro_monthly' | 'pro_yearly'>('pro_yearly');
  const [payMode, setPayMode] = useState<PayMode>('pix');
  const [installments, setInstallments] = useState<string>('10');

  const [creating, setCreating] = useState(false);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [payStatus, setPayStatus] = useState<'pending' | 'approved' | 'rejected' | 'expired'>('pending');
  const [copied, setCopied] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const pollTimer = useRef<number | null>(null);

  const loadPlan = useCallback(async () => {
    if (!user?.tenantId) return;
    let { data, error } = await supabase
      .from('tenant_plans' as any)
      .select('plan, status, trial_ends_at, current_period_end, mp_customer_id, monthly_price, yearly_price, monthly_discount_pct, yearly_discount_pct, courtesy_months, max_installments')
      .eq('tenant_id', user.tenantId)
      .maybeSingle();

    if (error) {
      const fallback = await supabase
        .from('tenant_plans' as any)
        .select('plan, status, trial_ends_at, current_period_end, mp_customer_id')
        .eq('tenant_id', user.tenantId)
        .maybeSingle();
      data = fallback.data;
    }

    if (data) {
      const decoded = decodePlanPricing(data);
      setPlan({
        ...(data as any),
        monthly_price: decoded.monthly_price,
        yearly_price: decoded.yearly_price,
        monthly_discount_pct: decoded.monthly_discount_pct,
        yearly_discount_pct: decoded.yearly_discount_pct,
        courtesy_months: decoded.courtesy_months,
        max_installments: decoded.max_installments,
      });
    } else {
      setPlan(null);
    }
    setLoading(false);
  }, [user?.tenantId]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  useEffect(() => {
    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
    };
  }, []);

  // Pricing calculations with tenant-specific discounts & courtesy months
  const decodedPricing = decodePlanPricing(plan);
  const monthlyBase = decodedPricing.monthly_price;
  const monthlyDisc = decodedPricing.monthly_discount_pct;
  const monthlyFinal = Math.round(monthlyBase * (1 - monthlyDisc / 100) * 100) / 100;

  const yearlyBase = decodedPricing.yearly_price;
  const yearlyDisc = decodedPricing.yearly_discount_pct;
  const yearlyFinal = Math.round(yearlyBase * (1 - yearlyDisc / 100) * 100) / 100;

  const courtesyMonths = decodedPricing.courtesy_months;
  const maxInstallments = decodedPricing.max_installments;
  const yearlySavings = Math.max(0, monthlyFinal * 12 - yearlyFinal);
  const installmentOptions = Array.from({ length: maxInstallments }, (_, i) => i + 1);

  const isTrial = plan?.plan === 'trial';
  const isPro = plan && plan.plan !== 'trial' && plan.status === 'active';
  const trialEnds = plan?.trial_ends_at ? new Date(plan.trial_ends_at) : null;
  const periodEnd = plan?.current_period_end ? new Date(plan.current_period_end) : null;
  const isLifetime = periodEnd && periodEnd.getFullYear() >= 2090;

  // Cálculo de proximidade de vencimento por dia civil local
  const targetDueDate = isTrial ? trialEnds : periodEnd;
  const dueDaysLeft = (() => {
    if (!targetDueDate || isLifetime) return null;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const targetStart = new Date(targetDueDate.getFullYear(), targetDueDate.getMonth(), targetDueDate.getDate()).getTime();
    return Math.round((targetStart - todayStart) / (1000 * 60 * 60 * 24));
  })();
  const daysLeft = trialEnds ? Math.max(0, dueDaysLeft ?? 0) : 0;

  const isExpiredOrDueToday = dueDaysLeft !== null && dueDaysLeft <= 0;
  const isDueSoon = dueDaysLeft !== null && dueDaysLeft <= 7;

  const activeAmount = selectedPlan === 'pro_monthly' ? monthlyFinal : yearlyFinal;
  const selectedInstallmentsNum = selectedPlan === 'pro_yearly' ? Math.min(maxInstallments, Math.max(1, parseInt(installments) || 1)) : 1;
  const installmentValue = activeAmount / selectedInstallmentsNum;

  const startPolling = useCallback((intentId: string) => {
    if (pollTimer.current) window.clearInterval(pollTimer.current);
    pollTimer.current = window.setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke('mp-check-payment', { body: { intent_id: intentId } });
        const s = (data as any)?.status as string | undefined;
        if (s === 'approved') {
          setPayStatus('approved');
          if (pollTimer.current) window.clearInterval(pollTimer.current);
          await loadPlan();
        } else if (s === 'rejected' || s === 'cancelled') {
          setPayStatus('rejected');
          if (pollTimer.current) window.clearInterval(pollTimer.current);
        }
      } catch (e) {
        console.error(e);
      }
    }, 3000) as unknown as number;
  }, [loadPlan]);

  const generatePixPayment = useCallback(async (which: 'pro_monthly' | 'pro_yearly') => {
    setCreating(true);
    setCreateError(null);
    setPayStatus('pending');
    setIntent(null);
    try {
      const { data, error } = await supabase.functions.invoke('mp-create-payment', { body: { plan: which } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setIntent(data as Intent);
      startPolling((data as Intent).intent_id);
    } catch (e: any) {
      console.error(e);
      setCreateError(e?.message || 'Erro ao gerar pagamento PIX');
    } finally {
      setCreating(false);
    }
  }, [startPolling]);

  const openCheckoutModal = useCallback((which: 'pro_monthly' | 'pro_yearly', mode: PayMode) => {
    if (pollTimer.current) window.clearInterval(pollTimer.current);
    setSelectedPlan(which);
    setPayMode(mode);
    setInstallments(which === 'pro_yearly' ? String(maxInstallments) : '1');
    setIntent(null);
    setPayStatus('pending');
    setCreateError(null);
    setCheckoutOpen(true);
    if (mode === 'pix') {
      void generatePixPayment(which);
    }
  }, [maxInstallments, generatePixPayment]);

  // Se veio do botão "Pagar agora" do cabeçalho (?tab=plano&pay=pix), abre o modal e gera o QR Code PIX automaticamente
  const payParam = searchParams.get('pay');
  const planParam = searchParams.get('plan');
  const triggerTimestamp = searchParams.get('t');

  useEffect(() => {
    if (loading || !payParam) return;
    const targetPlan: 'pro_monthly' | 'pro_yearly' =
      planParam === 'pro_yearly' || (plan?.plan === 'pro_yearly' && planParam !== 'pro_monthly')
        ? 'pro_yearly'
        : 'pro_monthly';
    const mode: PayMode = payParam === 'card' ? 'card' : 'pix';

    // Remove os parâmetros de disparo para não reabrir ao atualizar a página
    setSearchParams({ tab: 'plano' }, { replace: true });
    openCheckoutModal(targetPlan, mode);
  }, [loading, payParam, planParam, triggerTimestamp, plan?.plan, openCheckoutModal, setSearchParams]);

  const startCardCheckout = async () => {
    setCreating(true);
    setCreateError(null);
    setPayStatus('pending');
    setIntent(null);
    try {
      const { data, error } = await supabase.functions.invoke('mp-create-card-payment', {
        body: {
          plan: selectedPlan,
          installments: selectedInstallmentsNum,
          mode: 'preference',
          return_url: window.location.href,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const createdIntent = data as Intent;
      setIntent(createdIntent);
      startPolling(createdIntent.intent_id);

      if (createdIntent.checkout_url) {
        window.open(createdIntent.checkout_url, '_blank', 'noopener,noreferrer');
      }
    } catch (e: any) {
      console.error(e);
      setCreateError(e?.message || 'Erro ao iniciar pagamento com cartão no Mercado Pago');
    } finally {
      setCreating(false);
    }
  };

  const closeDialog = () => {
    if (pollTimer.current) window.clearInterval(pollTimer.current);
    setCheckoutOpen(false);
    setIntent(null);
    setPayStatus('pending');
    setCreateError(null);
  };

  const copyPix = async () => {
    if (!intent?.qr_code) return;
    await navigator.clipboard.writeText(intent.qr_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  const currentPlanKey: 'pro_monthly' | 'pro_yearly' = plan?.plan === 'pro_yearly' ? 'pro_yearly' : 'pro_monthly';
  const currentPlanAmount = currentPlanKey === 'pro_yearly' ? yearlyFinal : monthlyFinal;

  return (
    <div className="space-y-4">
      {/* Status do Plano Atual */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Seu plano atual
            </span>
            {courtesyMonths > 0 && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1">
                <Gift className="h-3.5 w-3.5" /> Benefício: +{courtesyMonths} {courtesyMonths === 1 ? 'mês' : 'meses'} de cortesia no plano anual
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Alerta de Proximidade de Vencimento no Cabeçalho do Plano */}
          {isDueSoon && targetDueDate && (
            <div
              role="alert"
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border ${
                isExpiredOrDueToday
                  ? 'bg-destructive/10 border-destructive/30 text-foreground'
                  : 'bg-amber-500/10 border-amber-500/30 text-foreground'
              }`}
            >
              <div className="flex items-start gap-2.5 text-xs">
                <AlertTriangle
                  className={`h-4 w-4 mt-0.5 shrink-0 ${
                    isExpiredOrDueToday ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'
                  }`}
                />
                <div className="space-y-0.5">
                  <p className="font-semibold text-sm">
                    {dueDaysLeft! < 0
                      ? `Assinatura vencida em ${targetDueDate.toLocaleDateString('pt-BR')}`
                      : dueDaysLeft === 0
                      ? `Sua assinatura vence HOJE (${targetDueDate.toLocaleDateString('pt-BR')})`
                      : `Sua assinatura vence em ${dueDaysLeft} ${dueDaysLeft === 1 ? 'dia' : 'dias'} (${targetDueDate.toLocaleDateString('pt-BR')})`}
                  </p>
                  <p className="text-muted-foreground">
                    Realize o pagamento de <strong>{fmtBRL(currentPlanAmount)}</strong> via PIX para renovar instantaneamente.
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                variant={isExpiredOrDueToday ? 'destructive' : 'default'}
                className="gap-1.5 shrink-0 font-semibold"
                onClick={() => openCheckoutModal(currentPlanKey, 'pix')}
              >
                <QrCode className="h-4 w-4" />
                Pagar agora ({fmtBRL(currentPlanAmount)})
              </Button>
            </div>
          )}

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
              {trialEnds && (<> Expira em <strong>{trialEnds.toLocaleDateString('pt-BR')}</strong>.</>)}
            </p>
          )}

          {isPro && periodEnd && (
            <p className="text-sm text-muted-foreground">
              {isLifetime ? (
                <>Vigência <strong className="text-foreground">Vitalícia</strong> ativa.</>
              ) : (
                <>Próxima renovação em <strong className="text-foreground">{periodEnd.toLocaleDateString('pt-BR')}</strong>.</>
              )}
            </p>
          )}

          {isPro && (
            <p className="text-sm text-muted-foreground">
              Valor configurado para sua loja:{' '}
              <strong className="text-foreground">
                {plan?.plan === 'pro_yearly' ? `${fmtBRL(yearlyFinal)}/ano` : `${fmtBRL(monthlyFinal)}/mês`}
              </strong>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Formas de Pagamento Disponíveis na Loja */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-success" />
            Formas de Pagamento Disponíveis (Mercado Pago)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-muted/30">
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">PIX Instantâneo (À vista)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                QR Code e PIX Copia e Cola gerados na hora com liberação automática da assinatura em segundos.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-muted/30">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                Cartão de Crédito em até {maxInstallments}x
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pague o valor total do Plano Anual dividido em até <strong>{maxInstallments}x de {fmtBRL(yearlyFinal / maxInstallments)}</strong> no cartão de crédito via Mercado Pago.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Planos e Renovação */}
      <Card>
        <CardHeader>
          <CardTitle>{isPro ? 'Opções de Plano & Renovação' : 'Faça upgrade para o PRO'}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card PRO Mensal */}
          <div className="p-5 rounded-xl border-2 border-primary bg-primary/5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-wider text-primary font-semibold">PRO Mensal</p>
                  {monthlyDisc > 0 && (
                    <Badge variant="outline" className="text-[10px] text-success border-success/40 bg-success/10">
                      -{monthlyDisc}% de desconto
                    </Badge>
                  )}
                </div>
                <p className="text-3xl font-heading font-bold text-foreground mt-1">
                  {fmtBRL(monthlyFinal)}
                  <span className="text-base font-normal text-muted-foreground">/mês</span>
                </p>
                {monthlyDisc > 0 && (
                  <p className="text-xs text-muted-foreground">
                    De <span className="line-through">{fmtBRL(monthlyBase)}</span> por {fmtBRL(monthlyFinal)}
                  </p>
                )}
              </div>

              <ul className="space-y-1.5 text-sm text-foreground">
                <li className="flex gap-2"><Check className="h-4 w-4 text-success shrink-0 mt-0.5" /> Pedidos, mesas e usuários ilimitados</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-success shrink-0 mt-0.5" /> Impressão térmica e múltiplos dispositivos</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-success shrink-0 mt-0.5" /> Relatórios financeiros e auditoria</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-success shrink-0 mt-0.5" /> Pagamento via PIX ou Cartão à vista</li>
              </ul>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <Button className="w-full gap-1.5" onClick={() => openCheckoutModal('pro_monthly', 'pix')}>
                <QrCode className="h-4 w-4" /> Assinar via PIX
              </Button>
              <Button variant="outline" className="w-full gap-1.5" onClick={() => openCheckoutModal('pro_monthly', 'card')}>
                <CreditCard className="h-4 w-4" /> Pagar no Cartão
              </Button>
            </div>
          </div>

          {/* Card PRO Anual (com parcelamento até 10x e meses de cortesia) */}
          <div className="p-5 rounded-xl border-2 border-amber-500/40 bg-amber-500/5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" /> PRO Anual
                  </p>
                  <div className="flex items-center gap-1">
                    {yearlyDisc > 0 && (
                      <Badge variant="outline" className="text-[10px] text-success border-success/40 bg-success/10">
                        -{yearlyDisc}% OFF
                      </Badge>
                    )}
                    {courtesyMonths > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
                        +{courtesyMonths} {courtesyMonths === 1 ? 'mês' : 'meses'} grátis
                      </Badge>
                    )}
                  </div>
                </div>

                <p className="text-3xl font-heading font-bold text-foreground mt-1">
                  {maxInstallments}x de {fmtBRL(yearlyFinal / maxInstallments)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Valor total de <strong className="text-foreground">{fmtBRL(yearlyFinal)}/ano</strong> no cartão ou PIX
                  {yearlyDisc > 0 && (
                    <span className="ml-1 line-through">{fmtBRL(yearlyBase)}</span>
                  )}
                </p>
                {yearlySavings > 0 && (
                  <p className="text-xs text-success font-medium mt-1">
                    Economize {fmtBRL(yearlySavings)} em relação ao plano mensal
                    {courtesyMonths > 0 ? ` (${courtesyMonths} ${courtesyMonths === 1 ? 'mês' : 'meses'} de cortesia)` : ''}
                  </p>
                )}
              </div>

              <ul className="space-y-1.5 text-sm text-foreground">
                <li className="flex gap-2"><Check className="h-4 w-4 text-success shrink-0 mt-0.5" /> Tudo do PRO Mensal incluso</li>
                <li className="flex gap-2">
                  <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                  <span>Parcelamento em até <strong>{maxInstallments}x no cartão de crédito</strong></span>
                </li>
                {courtesyMonths > 0 && (
                  <li className="flex gap-2">
                    <Check className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <span><strong>+{courtesyMonths} {courtesyMonths === 1 ? 'mês' : 'meses'} de brinde/cortesia</strong> na assinatura</span>
                  </li>
                )}
                <li className="flex gap-2"><Check className="h-4 w-4 text-success shrink-0 mt-0.5" /> Preço fixo garantido durante toda a vigência</li>
              </ul>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <Button
                className="w-full gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => openCheckoutModal('pro_yearly', 'card')}
              >
                <CreditCard className="h-4 w-4" /> Cartão até {maxInstallments}x
              </Button>
              <Button
                variant="outline"
                className="w-full gap-1.5 border-amber-500/40 hover:bg-amber-500/10"
                onClick={() => openCheckoutModal('pro_yearly', 'pix')}
              >
                <QrCode className="h-4 w-4" /> Pagar via PIX
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {createError && !checkoutOpen && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-sm p-3">
          {createError}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Pagamentos via PIX e Cartão de Crédito processados com segurança pelo Mercado Pago. A ativação do plano é automática após a confirmação.
      </p>

      {/* Modal Unificado de Checkout (PIX ou Cartão em até 10x) */}
      <Dialog open={checkoutOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-success" />
              {payStatus === 'approved'
                ? 'Pagamento confirmado!'
                : payStatus === 'rejected'
                ? 'Pagamento não concluído'
                : `${selectedPlan === 'pro_yearly' ? 'Assinatura PRO Anual' : 'Assinatura PRO Mensal'}`}
            </DialogTitle>
            <DialogDescription>
              {payStatus === 'approved' && 'Seu plano PRO já está ativo e liberado.'}
              {payStatus === 'rejected' && 'Tente novamente ou escolha outra forma de pagamento.'}
              {payStatus === 'pending' && (
                <>
                  Valor total: <strong>{fmtBRL(activeAmount)}</strong>
                  {selectedPlan === 'pro_yearly' && courtesyMonths > 0 && (
                    <> · Inclui <strong>+{courtesyMonths} {courtesyMonths === 1 ? 'mês' : 'meses'} de cortesia</strong></>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {payStatus === 'pending' && (
            <div className="space-y-4">
              {/* Seletor de Forma de Pagamento dentro do Modal */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setPayMode('pix');
                    setCreateError(null);
                    if (!intent?.qr_code) void generatePixPayment(selectedPlan);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-colors ${
                    payMode === 'pix' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <QrCode className="h-3.5 w-3.5" /> PIX (À vista)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (pollTimer.current) window.clearInterval(pollTimer.current);
                    setPayMode('card');
                    setIntent(null);
                    setCreateError(null);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-colors ${
                    payMode === 'card' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  Cartão {selectedPlan === 'pro_yearly' ? `(até ${maxInstallments}x)` : '(1x)'}
                </button>
              </div>

              {createError && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-xs p-3">
                  {createError}
                </div>
              )}

              {/* ABA PIX */}
              {payMode === 'pix' && (
                <div className="space-y-4">
                  {creating && (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="text-xs">Gerando QR Code PIX no Mercado Pago...</span>
                    </div>
                  )}

                  {!creating && intent?.qr_code_base64 && (
                    <div className="flex justify-center">
                      <img
                        src={`data:image/png;base64,${intent.qr_code_base64}`}
                        alt="QR Code PIX"
                        className="w-56 h-56 rounded-lg border border-border bg-white p-2"
                      />
                    </div>
                  )}

                  {!creating && intent?.qr_code && (
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">PIX copia e cola</label>
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={intent.qr_code}
                          className="flex-1 min-w-0 rounded-md border border-input bg-muted/40 px-3 py-2 text-xs font-mono"
                        />
                        <Button size="sm" variant="outline" onClick={copyPix}>
                          {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  )}

                  {!creating && intent && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Aguardando confirmação do PIX...
                    </div>
                  )}

                  {!creating && !intent && (
                    <Button className="w-full" onClick={() => generatePixPayment(selectedPlan)}>
                      <QrCode className="h-4 w-4 mr-2" /> Gerar QR Code PIX ({fmtBRL(activeAmount)})
                    </Button>
                  )}
                </div>
              )}

              {/* ABA CARTÃO DE CRÉDITO (ATÉ 10X NO ANUAL) */}
              {payMode === 'card' && (
                <div className="space-y-4">
                  {selectedPlan === 'pro_yearly' ? (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-foreground">
                        Escolha o parcelamento no Cartão de Crédito:
                      </label>
                      <Select value={installments} onValueChange={setInstallments}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {installmentOptions.map(n => (
                            <SelectItem key={n} value={String(n)}>
                              {n}x de {fmtBRL(yearlyFinal / n)} — Total {fmtBRL(yearlyFinal)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                      No plano mensal, o pagamento no cartão de crédito é cobrado em <strong>1x de {fmtBRL(monthlyFinal)}</strong>. Para parcelar em até {maxInstallments}x, selecione o <strong>PRO Anual</strong>.
                    </div>
                  )}

                  <div className="p-3.5 rounded-xl border bg-primary/5 border-primary/20 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Parcelamento selecionado:</span>
                      <span className="font-bold text-foreground">
                        {selectedInstallmentsNum}x de {fmtBRL(installmentValue)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor total da assinatura:</span>
                      <span className="font-semibold text-foreground">{fmtBRL(activeAmount)}</span>
                    </div>
                  </div>

                  {!intent?.checkout_url ? (
                    <Button
                      className="w-full gap-2"
                      onClick={startCardCheckout}
                      disabled={creating}
                    >
                      {creating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Preparando Checkout Seguro...
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4" />
                          Pagar {selectedInstallmentsNum}x de {fmtBRL(installmentValue)} no Mercado Pago
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <Button
                        asChild
                        className="w-full gap-2"
                      >
                        <a href={intent.checkout_url} target="_blank" rel="noopener noreferrer">
                          Abrir Checkout de Cartão no Mercado Pago <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Aguardando confirmação do pagamento no cartão...
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {payStatus === 'approved' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-16 w-16 text-success" />
              <Button onClick={closeDialog}>Fechar</Button>
            </div>
          )}

          {payStatus === 'rejected' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <XCircle className="h-16 w-16 text-destructive" />
              <Button onClick={closeDialog}>Fechar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
