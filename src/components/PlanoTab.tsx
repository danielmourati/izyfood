import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CreditCard, Check, Loader2, Copy, CheckCircle2, XCircle } from 'lucide-react';

type PlanType = 'trial' | 'pro_monthly' | 'pro_yearly';
type PlanStatus = 'active' | 'expired' | 'canceled' | 'pending_payment';

interface Plan {
  plan: PlanType;
  status: PlanStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

interface Intent {
  intent_id: string;
  qr_code: string | null;
  qr_code_base64: string | null;
  ticket_url: string | null;
  amount: number;
  expires_at: string;
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

  const [creating, setCreating] = useState<PlanType | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [payStatus, setPayStatus] = useState<'pending' | 'approved' | 'rejected' | 'expired'>('pending');
  const [copied, setCopied] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const pollTimer = useRef<number | null>(null);

  const loadPlan = async () => {
    if (!user?.tenantId) return;
    const { data } = await supabase
      .from('tenant_plans' as any)
      .select('plan, status, trial_ends_at, current_period_end')
      .eq('tenant_id', user.tenantId)
      .maybeSingle();
    setPlan((data as any) || null);
    setLoading(false);
  };

  useEffect(() => { loadPlan(); /* eslint-disable-next-line */ }, [user?.tenantId]);

  useEffect(() => {
    return () => { if (pollTimer.current) window.clearInterval(pollTimer.current); };
  }, []);

  const isTrial = plan?.plan === 'trial';
  const isPro = plan && plan.plan !== 'trial' && plan.status === 'active';
  const trialEnds = plan?.trial_ends_at ? new Date(plan.trial_ends_at) : null;
  const now = new Date();
  const daysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const periodEnd = plan?.current_period_end ? new Date(plan.current_period_end) : null;

  const startCheckout = async (which: 'pro_monthly' | 'pro_yearly') => {
    setCreating(which);
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
      setCreateError(e?.message || 'Erro ao gerar pagamento');
    } finally {
      setCreating(null);
    }
  };

  const startPolling = (intentId: string) => {
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
      } catch (e) { console.error(e); }
    }, 3000) as unknown as number;
  };

  const closeDialog = () => {
    if (pollTimer.current) window.clearInterval(pollTimer.current);
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
      <div className="flex items-center gap-2 text-muted-foreground text-sm p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando plano...
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
              {trialEnds && (<> Expira em <strong>{trialEnds.toLocaleDateString('pt-BR')}</strong>.</>)}
            </p>
          )}

          {isPro && periodEnd && (
            <p className="text-sm text-muted-foreground">
              Próxima renovação em <strong className="text-foreground">{periodEnd.toLocaleDateString('pt-BR')}</strong>.
            </p>
          )}
        </CardContent>
      </Card>

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
              <Button className="w-full" onClick={() => startCheckout('pro_monthly')} disabled={creating !== null}>
                {creating === 'pro_monthly' ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando PIX...</> : <><CreditCard className="h-4 w-4 mr-2" /> Assinar via PIX</>}
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
              <Button variant="outline" className="w-full" onClick={() => startCheckout('pro_yearly')} disabled={creating !== null}>
                {creating === 'pro_yearly' ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando PIX...</> : <><CreditCard className="h-4 w-4 mr-2" /> Assinar via PIX</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {createError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-sm p-3">
          {createError}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Pagamento via PIX processado pelo Mercado Pago. A ativação é automática após a confirmação.
      </p>

      <Dialog open={!!intent} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {payStatus === 'approved' ? 'Pagamento confirmado!' : payStatus === 'rejected' ? 'Pagamento não concluído' : 'Pague com PIX'}
            </DialogTitle>
            <DialogDescription>
              {payStatus === 'pending' && intent && (
                <>Valor: <strong>R$ {intent.amount.toFixed(2).replace('.', ',')}</strong> — expira em 30 min. Estamos verificando o pagamento automaticamente.</>
              )}
              {payStatus === 'approved' && 'Seu plano PRO já está ativo.'}
              {payStatus === 'rejected' && 'Tente novamente ou gere um novo PIX.'}
            </DialogDescription>
          </DialogHeader>

          {payStatus === 'pending' && intent && (
            <div className="space-y-4">
              {intent.qr_code_base64 && (
                <div className="flex justify-center">
                  <img
                    src={`data:image/png;base64,${intent.qr_code_base64}`}
                    alt="QR Code PIX"
                    className="w-56 h-56 rounded-lg border border-border bg-white p-2"
                  />
                </div>
              )}
              {intent.qr_code && (
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
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Aguardando confirmação do PIX...
              </div>
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
