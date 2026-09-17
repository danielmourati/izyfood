import { useCallback, useEffect, useState } from 'react';
import { Printer, RefreshCw, Trash2, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { usePrinter } from '@/hooks/use-printer';
import {
  clearDonePrintJobs,
  fetchPrintJobs,
  printJobKindLabels,
  printJobStatusLabels,
  retryPrintJob,
  type PrintJob,
} from '@/lib/print-queue';

const statusClass: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  printing: 'bg-primary/15 text-primary border-primary/30',
  done: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  error: 'bg-destructive/15 text-destructive border-destructive/30',
};

function fmtHour(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Painel da fila de impressão + chave que transforma este aparelho no "Caixa"
 * que imprime os cupons enviados pelos outros aparelhos.
 */
export default function PrintQueuePanel() {
  const { user } = useAuth();
  const { printHostEnabled, togglePrintHost, hasPrinterAvailable, hostOnline } = usePrinter();
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setJobs(await fetchPrintJobs(20));
    } catch (err) {
      console.warn('[print-queue] falha ao carregar fila', err);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const tenantId = user?.tenantId;
    if (!tenantId) return;
    const channel = supabase
      .channel(`print-queue-panel:${tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'print_jobs', filter: `tenant_id=eq.${tenantId}` },
        () => { load(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.tenantId, load]);

  const handleRetry = async (id: string) => {
    setBusy(true);
    try { await retryPrintJob(id); await load(); } finally { setBusy(false); }
  };

  const handleClear = async () => {
    setBusy(true);
    try { await clearDonePrintJobs(); await load(); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Este aparelho imprime para os outros (Caixa)</span>
          </div>
          <Switch checked={printHostEnabled} onCheckedChange={togglePrintHost} />
        </div>

        {printHostEnabled ? (
          hasPrinterAvailable ? (
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Ativo: os cupons enviados pelos atendentes serão impressos aqui enquanto este aparelho estiver aberto.
            </p>
          ) : (
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              Ligue "Usar impressora neste dispositivo" e conecte a impressora — sem isso os cupons ficam na fila como falhados.
            </p>
          )
        ) : (
          <p className="text-xs text-muted-foreground leading-snug">
            Ligue esta chave no aparelho que fica com a impressora. Os outros aparelhos deixam de precisar de Bluetooth e passam a enviar os cupons para cá.
            {hostOnline ? ' Já existe um caixa online nesta loja.' : ' Nenhum caixa online nesta loja agora.'}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="font-extrabold uppercase tracking-wider text-[11px] text-muted-foreground">
          Fila de impressão
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs font-bold" onClick={load} disabled={busy}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs font-bold" onClick={handleClear} disabled={busy}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Limpar impressos
          </Button>
        </div>
      </div>

      {jobs.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum cupom na fila.</p>
      ) : (
        <div className="space-y-1.5">
          {jobs.map(job => (
            <div key={job.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-card p-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Printer className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{printJobKindLabels[job.kind] || job.kind}</span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  {job.device_label || 'Aparelho'} · {fmtHour(job.created_at)}
                  {job.error ? ` · ${job.error}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${statusClass[job.status] || ''}`}>
                  {printJobStatusLabels[job.status] || job.status}
                </span>
                {job.status === 'error' && (
                  <Button size="sm" variant="secondary" className="h-7 text-[11px] font-bold" disabled={busy} onClick={() => handleRetry(job.id)}>
                    Tentar novamente
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
