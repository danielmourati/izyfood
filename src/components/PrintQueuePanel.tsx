import TakeoverPrintHostButton from '@/components/TakeoverPrintHostButton';
import { useCallback, useEffect, useState } from 'react';
import { Printer, RefreshCw, Trash2, Monitor, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { usePrinter } from '@/hooks/use-printer';
import {
  clearDonePrintJobs,
  purgeOldPrintJobs,
  fetchPrintJobs,
  printJobKindLabels,
  printJobStatusLabels,
  forcePrintJobs,
  canForcePrintJob,
  canCancelPrintJob,
  cancelPrintJobs,
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
export default function PrintQueuePanel({ part = 'all' }: { part?: 'all' | 'host' | 'queue' } = {}) {
  const { user } = useAuth();
  const { printHostEnabled, togglePrintHost, hasPrinterAvailable, hostOnline, hostLabel, hostBlocked, hostBusy, hostMessage } = usePrinter();
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setJobs((await fetchPrintJobs(20)).filter(j => j.status !== 'done'));
    } catch (err) {
      console.warn('[print-queue] falha ao carregar fila', err);
    }
  }, []);

  useEffect(() => {
    if (part === 'host') return;
    purgeOldPrintJobs().finally(load);
    // Limpeza automática da fila a cada 1 minuto.
    const t = window.setInterval(() => { purgeOldPrintJobs().finally(load); }, 60 * 1000);
    return () => window.clearInterval(t);
  }, [load, part]);

  useEffect(() => {
    const tenantId = user?.tenantId;
    if (!tenantId || part === 'host') return;
    // Nome único por instância: dois painéis na mesma tela não podem reaproveitar o mesmo canal.
    const channel = supabase
      .channel(`print-queue-panel:${tenantId}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'print_jobs', filter: `tenant_id=eq.${tenantId}` },
        () => { load(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.tenantId, load, part]);

  const [forceMsg, setForceMsg] = useState<string | null>(null);
  const handleForce = async (ids?: string[]) => {
    setBusy(true);
    setForceMsg(null);
    try {
      const n = await forcePrintJobs(ids);
      setForceMsg(!hostOnline && !printHostEnabled
        ? 'Nenhum Caixa (servidor de impressão) ativo agora. Os cupons ficam na fila até um Caixa ser ligado.'
        : n > 0 ? `${n} cupom(ns) reenviado(s) ao Caixa.` : 'Nada para forçar (cupons de mesas já fechadas foram retirados).');
      await load();
    } catch (err: any) {
      setForceMsg('Não foi possível forçar a impressão: ' + (err?.message || 'erro'));
    } finally { setBusy(false); }
  };
  const forceable = (j: PrintJob) => canForcePrintJob(j);
  const cancelable = (j: PrintJob) => canCancelPrintJob(j);

  // Confirmação na própria tela: null = nada pendente; [] = todos; [id] = um cupom.
  const [confirmCancel, setConfirmCancel] = useState<string[] | null>(null);
  const cancelCount = confirmCancel === null ? 0 : (confirmCancel.length ? confirmCancel.length : jobs.filter(cancelable).length);
  const handleCancel = async () => {
    if (confirmCancel === null) return;
    setBusy(true);
    setForceMsg(null);
    try {
      const n = await cancelPrintJobs(confirmCancel);
      setForceMsg(n > 0 ? `${n} cupom(ns) cancelado(s). Eles não serão impressos.` : 'Nenhum cupom para cancelar.');
      await load();
    } catch (err: any) {
      setForceMsg('Não foi possível cancelar: ' + (err?.message || 'erro'));
    } finally {
      setBusy(false);
      setConfirmCancel(null);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    try { await clearDonePrintJobs(); await load(); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      {part !== 'queue' && <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Este aparelho imprime para os outros (Caixa)</span>
          </div>
          <Switch aria-label="Este aparelho imprime para os outros (Caixa)" checked={printHostEnabled} onCheckedChange={togglePrintHost} disabled={hostBlocked || hostBusy} />
        </div>

        {hostMessage && <p role="alert" className="text-xs text-destructive">{hostMessage}</p>}
        <TakeoverPrintHostButton />
        {hostBlocked ? (
          <p role="status" className="text-xs text-muted-foreground">Caixa ativo: {hostLabel || 'outro aparelho'}. Desative esse Caixa para ativar este aparelho.</p>
        ) : printHostEnabled ? (
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
      </div>}

      {part !== 'host' && <>
      <div className="flex items-center justify-between gap-2">
        <span className="font-extrabold uppercase tracking-wider text-[11px] text-muted-foreground">
          Fila de impressão
        </span>
        <div className="flex gap-2">
          {jobs.some(forceable) && (
            <Button size="sm" className="h-7 text-xs font-bold" onClick={() => handleForce()} disabled={busy}>
              <Printer className="h-3.5 w-3.5 mr-1" /> Forçar todos
            </Button>
          )}
          {jobs.some(cancelable) && (
            <Button size="sm" variant="destructive" className="h-7 text-xs font-bold" onClick={() => setConfirmCancel([])} disabled={busy}>
              <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar todos
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs font-bold" onClick={load} disabled={busy}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs font-bold" onClick={handleClear} disabled={busy}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Limpar impressos
          </Button>
        </div>
      </div>

      {confirmCancel !== null && (
        <div role="alertdialog" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2">
          <span className="text-xs font-bold text-destructive">
            Cancelar {cancelCount} cupom(ns)? Eles não serão impressos.
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs font-bold" onClick={() => setConfirmCancel(null)} disabled={busy}>
              Voltar
            </Button>
            <Button size="sm" variant="destructive" className="h-7 text-xs font-bold" onClick={handleCancel} disabled={busy}>
              Sim, cancelar
            </Button>
          </div>
        </div>
      )}
      {forceMsg && <p role="status" className="text-xs font-semibold text-primary">{forceMsg}</p>}
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
                  {job.status === 'done' && job.printed_on ? ` · ${job.printed_on}` : ''}
                  {job.error ? ` · ${job.error}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${statusClass[job.status] || ''}`}>
                  {printJobStatusLabels[job.status] || job.status}
                </span>
                {forceable(job) && (
                  <Button size="sm" variant="secondary" className="h-7 text-[11px] font-bold" disabled={busy} onClick={() => handleForce([job.id])}>
                    Forçar impressão
                  </Button>
                )}
                {cancelable(job) && (
                  <Button size="sm" variant="outline" className="h-7 text-[11px] font-bold text-destructive border-destructive/40" disabled={busy} onClick={() => setConfirmCancel([job.id])}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      </>}
    </div>
  );
}
