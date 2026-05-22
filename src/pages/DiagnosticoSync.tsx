import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { RefreshCw, Copy, Zap, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';

type ChannelStatus = 'connecting' | 'ok' | 'error' | 'timeout';

interface TableState {
  status: ChannelStatus;
  eventCount: number;
  lastEventAt: number | null;
  lastEventType: string | null;
  lastError?: string;
}

const MONITORED_TABLES = [
  'tenants',
  'products',
  'categories',
  'orders',
  'store_tables',
  'store_settings',
  'customers',
  'printer_configs',
  'cash_registers',
  'cash_movements',
  'sales',
  'suppliers',
  'coupons',
  'stock_entries',
  'tenant_members',
] as const;

const statusColor = (s: ChannelStatus) => {
  switch (s) {
    case 'ok': return 'bg-green-500';
    case 'connecting': return 'bg-yellow-500 animate-pulse';
    case 'error': return 'bg-red-500';
    case 'timeout': return 'bg-orange-500';
  }
};

const statusLabel = (s: ChannelStatus) => {
  switch (s) {
    case 'ok': return 'OK';
    case 'connecting': return 'Conectando';
    case 'error': return 'Erro';
    case 'timeout': return 'Timeout';
  }
};

const formatRelative = (ts: number | null) => {
  if (!ts) return 'nunca';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return 'agora';
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
  return `${Math.floor(diff / 3600)}h atrás`;
};

interface SettingsConsistency {
  rowCount: number;
  tableCount: number | null;
  serviceFeePercentage: number | null;
  hasPrintSettings: boolean;
  checkedAt: number;
}

export default function DiagnosticoSync() {
  const { user } = useAuth();
  const [states, setStates] = useState<Record<string, TableState>>(() => {
    const init: Record<string, TableState> = {};
    MONITORED_TABLES.forEach(t => {
      init[t] = { status: 'connecting', eventCount: 0, lastEventAt: null, lastEventType: null };
    });
    return init;
  });
  const [pinging, setPinging] = useState(false);
  const [lastPing, setLastPing] = useState<{ sentAt: number; receivedAt: number | null; latencyMs: number | null } | null>(null);
  const [tick, setTick] = useState(0);
  const [consistency, setConsistency] = useState<SettingsConsistency | null>(null);
  const [checkingConsistency, setCheckingConsistency] = useState(false);
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const pingSentAtRef = useRef<number | null>(null);

  // Re-render every 1s to refresh relative timestamps
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Subscribe to every monitored table
  useEffect(() => {
    const channels: RealtimeChannel[] = MONITORED_TABLES.map(table => {
      const channel = supabase
        .channel(`diag-${table}`)
        .on(
          'postgres_changes' as any,
          { event: '*', schema: 'public', table },
          (payload: any) => {
            const now = Date.now();
            setStates(prev => ({
              ...prev,
              [table]: {
                ...prev[table],
                eventCount: prev[table].eventCount + 1,
                lastEventAt: now,
                lastEventType: payload.eventType || payload.type || 'CHANGE',
              },
            }));
            // Detect ping echo on store_settings
            if (table === 'store_settings' && pingSentAtRef.current) {
              const sentAt = pingSentAtRef.current;
              pingSentAtRef.current = null;
              setLastPing({ sentAt, receivedAt: now, latencyMs: now - sentAt });
              setPinging(false);
            }
          }
        )
        .subscribe((status) => {
          setStates(prev => ({
            ...prev,
            [table]: {
              ...prev[table],
              status:
                status === 'SUBSCRIBED' ? 'ok' :
                status === 'CHANNEL_ERROR' ? 'error' :
                status === 'TIMED_OUT' ? 'timeout' : 'connecting',
              lastError: status !== 'SUBSCRIBED' ? String(status) : undefined,
            },
          }));
        });
      return channel;
    });

    channelsRef.current = channels;
    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
      channelsRef.current = [];
    };
  }, []);

  const sendPing = useCallback(async () => {
    if (!user?.tenantId) return;
    setPinging(true);
    pingSentAtRef.current = Date.now();
    setLastPing({ sentAt: pingSentAtRef.current, receivedAt: null, latencyMs: null });

    // Fetch existing settings id, then update updated_at via a no-op update
    const { data: existing } = await supabase
      .from('store_settings')
      .select('id, table_count')
      .eq('tenant_id', user.tenantId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('store_settings')
        .update({ table_count: existing.table_count })
        .eq('id', existing.id);
    } else {
      await supabase.from('store_settings').insert({ table_count: 20 });
    }

    // Timeout fallback
    setTimeout(() => {
      if (pingSentAtRef.current) {
        pingSentAtRef.current = null;
        setPinging(false);
      }
    }, 8000);
  }, [user?.tenantId]);

  const checkConsistency = useCallback(async () => {
    if (!user?.tenantId) return;
    setCheckingConsistency(true);
    const { data, error } = await supabase
      .from('store_settings')
      .select('table_count, service_fee_percentage, print_settings')
      .eq('tenant_id', user.tenantId);
    if (!error) {
      const rows = data || [];
      const first: any = rows[0];
      setConsistency({
        rowCount: rows.length,
        tableCount: first?.table_count ?? null,
        serviceFeePercentage: first?.service_fee_percentage != null ? Number(first.service_fee_percentage) : null,
        hasPrintSettings: !!(first?.print_settings && Object.keys(first.print_settings).length > 0),
        checkedAt: Date.now(),
      });
    }
    setCheckingConsistency(false);
  }, [user?.tenantId]);

  // Auto-check consistency on mount and whenever store_settings event arrives
  useEffect(() => { checkConsistency(); }, [checkConsistency]);
  useEffect(() => {
    const lastEvt = states['store_settings']?.lastEventAt;
    if (lastEvt) checkConsistency();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states['store_settings']?.lastEventAt]);

  const copyReport = useCallback(() => {
    const report = {
      generatedAt: new Date().toISOString(),
      tenantId: user?.tenantId,
      tenantSlug: user?.tenantSlug,
      lastPing,
      tables: Object.entries(states).map(([table, s]) => ({
        table,
        status: s.status,
        eventCount: s.eventCount,
        lastEventAt: s.lastEventAt ? new Date(s.lastEventAt).toISOString() : null,
        lastEventType: s.lastEventType,
      })),
    };
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
  }, [states, lastPing, user]);

  const okCount = Object.values(states).filter(s => s.status === 'ok').length;
  const totalCount = MONITORED_TABLES.length;
  const allOk = okCount === totalCount;

  return (
    <div className="h-full overflow-auto p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Diagnóstico de Sincronização</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Verifica em tempo real se as alterações feitas em outro dispositivo chegam até este.
        </p>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {allOk ? (
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            ) : (
              <AlertCircle className="h-8 w-8 text-yellow-500" />
            )}
            <div>
              <div className="text-lg font-semibold">
                {okCount} / {totalCount} canais conectados
              </div>
              <div className="text-xs text-muted-foreground">
                {allOk ? 'Sincronização operacional' : 'Alguns canais não conectaram — veja a tabela abaixo'}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={sendPing} disabled={pinging || !allOk} size="sm">
              {pinging ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              Disparar ping de teste
            </Button>
            <Button onClick={copyReport} variant="outline" size="sm">
              <Copy className="h-4 w-4 mr-2" />
              Copiar relatório
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ping result */}
      {lastPing && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm">
                <span className="text-muted-foreground">Último ping:</span>{' '}
                <span className="font-mono">{new Date(lastPing.sentAt).toLocaleTimeString('pt-BR')}</span>
              </div>
              {lastPing.latencyMs !== null ? (
                <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">
                  Round-trip: {lastPing.latencyMs} ms
                </Badge>
              ) : (
                <Badge variant="outline" className="border-yellow-500/30 text-yellow-700 dark:text-yellow-400">
                  Aguardando eco…
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Consistency check */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Estado persistido em store_settings</span>
            <Button size="sm" variant="outline" onClick={checkConsistency} disabled={checkingConsistency}>
              {checkingConsistency ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
              Reconferir
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!consistency ? (
            <p className="text-muted-foreground text-xs">Aguardando leitura…</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Linhas para este tenant</span>
                {consistency.rowCount === 1 ? (
                  <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">
                    1 (correto)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-red-500/40 text-red-700 dark:text-red-400">
                    {consistency.rowCount} — divergência!
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Taxa de serviço salva</span>
                <span className="font-mono">{consistency.serviceFeePercentage ?? '—'}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Quantidade de mesas salva</span>
                <span className="font-mono">{consistency.tableCount ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Configurações de impressão</span>
                <Badge variant="outline">{consistency.hasPrintSettings ? 'preenchido' : 'vazio'}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/60">
                Esta seção lê o banco diretamente. Se o canal recebe evento mas estes valores não mudam, o problema está na gravação (não no Realtime).
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Tables grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Tabelas monitoradas</span>
            <span className="text-xs font-normal text-muted-foreground">
              <RefreshCw className="h-3 w-3 inline mr-1" />
              atualiza a cada 1s
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Tabela</th>
                  <th className="text-left px-4 py-2 font-medium">Canal</th>
                  <th className="text-right px-4 py-2 font-medium">Eventos</th>
                  <th className="text-left px-4 py-2 font-medium">Último evento</th>
                </tr>
              </thead>
              <tbody>
                {MONITORED_TABLES.map(table => {
                  const s = states[table];
                  return (
                    <tr key={table} className="border-t border-border/60 hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-mono text-xs">{table}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${statusColor(s.status)}`} />
                          <span className="text-xs">{statusLabel(s.status)}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{s.eventCount}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {formatRelative(s.lastEventAt)}
                        {s.lastEventType && <span className="ml-2 opacity-70">({s.lastEventType})</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como testar entre dispositivos</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Deixe esta tela aberta neste dispositivo.</p>
          <p>2. Em outro dispositivo (celular, tablet, outra aba), faça alguma alteração — por exemplo, edite o nome da loja em <strong>Configurações</strong>, crie um produto novo ou abra uma mesa.</p>
          <p>3. Volte aqui: a linha da tabela correspondente deve mostrar "agora" e o contador de eventos deve aumentar em poucos segundos.</p>
          <p>4. Se uma tabela nunca registra eventos mesmo após alterações confirmadas, há problema de publication ou RLS naquela tabela.</p>
          <p className="pt-2 border-t border-border/60">O botão <strong>Disparar ping</strong> faz um UPDATE inócuo em <code className="font-mono text-xs">store_settings</code> e mede o tempo de ida e volta — útil para confirmar saúde do canal sem precisar de segundo dispositivo.</p>
        </CardContent>
      </Card>
    </div>
  );
}
