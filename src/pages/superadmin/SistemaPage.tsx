import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings2, Wallet, ShieldCheck, CheckCircle2, Copy, Activity, AlertCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

type WebhookEvent = {
  id: string;
  event_type: string | null;
  event_id: string | null;
  signature_valid: boolean | null;
  processed: boolean;
  error: string | null;
  created_at: string;
};

export function SistemaPage() {
  const [copied, setCopied] = useState(false);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [last24h, setLast24h] = useState(0);
  const webhookUrl = `${SUPABASE_URL}/functions/v1/mp-webhook`;

  const copy = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const client = supabase as any;
    const { data } = await client
      .from('webhook_events')
      .select('id,event_type,event_id,signature_valid,processed,error,created_at')
      .eq('source', 'mercadopago')
      .order('created_at', { ascending: false })
      .limit(20);
    const { count } = await client
      .from('webhook_events')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'mercadopago');
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: c24 } = await client
      .from('webhook_events')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'mercadopago')
      .gte('created_at', since);
    setEvents(data || []);
    setTotal(count || 0);
    setLast24h(c24 || 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Settings2 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-heading font-bold">Sistema</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" /> Integração Mercado Pago
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center gap-2 rounded-lg bg-success/10 border border-success/30 px-3 py-2 text-success text-xs w-fit">
            <CheckCircle2 className="h-4 w-4" /> Integração ativa (PIX via API de pagamentos)
          </div>

          <div className="space-y-2">
            <p className="text-muted-foreground">
              Configure a URL abaixo em <strong>Mercado Pago &rarr; Suas integrações &rarr; Notificações Webhook</strong>,
              assinando o evento <code className="text-xs bg-muted px-1 rounded">payment</code>:
            </p>
            <div className="flex gap-2">
              <input readOnly value={webhookUrl}
                className="flex-1 min-w-0 rounded-md border border-input bg-muted/40 px-3 py-2 text-xs font-mono" />
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>Credenciais armazenadas em segredo:</p>
            <ul className="list-disc pl-5">
              <li><code>MP_ACCESS_TOKEN</code> — Access token de produção</li>
              <li><code>MP_WEBHOOK_SECRET</code> — Segredo para validar assinatura das notificações</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" /> Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Todas as operações do Super Admin ficam registradas em Auditoria.</p>
          <p>Aprovações de pagamento geram entrada <code className="text-xs">plan_upgraded</code> nos logs.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusPill({ label, value, tone }: { label: string; value: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }) {
  const toneCls = {
    success: 'bg-success/10 border-success/30 text-success',
    warning: 'bg-warning/10 border-warning/30 text-warning',
    danger: 'bg-destructive/10 border-destructive/30 text-destructive',
    neutral: 'bg-muted/40 border-border text-foreground',
  }[tone];
  return (
    <div className={`rounded-lg border px-3 py-2 ${toneCls}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-lg font-bold leading-tight">{value}</div>
    </div>
  );
}
