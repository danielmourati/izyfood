import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { usePrinter } from '@/hooks/use-printer';
import { printHostPresence } from '@/lib/print-host-presence';
import { consumeLastPrinterUsed, getDeviceId, getDeviceLabel } from '@/lib/printer';
import {
  claimPrintJob,
  fetchOpenPrintJobs,
  markPrintJobDone,
  markPrintJobError,
  purgeOldPrintJobs,
  PRINT_TIMEOUT_MS,
  type PrintJob,
} from '@/lib/print-queue';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('A impressora não respondeu (tempo esgotado).')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/**
 * Modo "Caixa": este aparelho mantém a impressora conectada e imprime os cupons
 * que os atendentes enviam para a fila (print_jobs).
 */
export function usePrintHost() {
  const { user } = useAuth();
  const { printHostEnabled, printHostRequested, hasPrinterAvailable, printOrder, printBill, printCashClose } = usePrinter();
  const [processing, setProcessing] = useState<string | null>(null);

  const queueRef = useRef<string[]>([]);
  const runningRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());
  const printerReadyRef = useRef(hasPrinterAvailable);
  const hostEnabledRef = useRef(printHostEnabled);
  hostEnabledRef.current = printHostEnabled;

  useEffect(() => { printerReadyRef.current = hasPrinterAvailable; }, [hasPrinterAvailable]);

  const printJob = useCallback(async (job: PrintJob) => {
    const payload = job.payload || {};
    if (job.kind === 'bill') return printBill(payload, { force: true });
    if (job.kind === 'cash_close') return printCashClose(payload, { force: true });
    const intent = payload.__printIntent === 'reprint' ? 'reprint' : 'new';
    return printOrder(payload, { force: true, intent });
  }, [printOrder, printBill, printCashClose]);

  const drain = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      while (queueRef.current.length > 0 && hostEnabledRef.current) {
        // No claims/errors while disconnected: preserve the queue until ready.
        if (!printerReadyRef.current) break;
        const jobId = queueRef.current.shift();
        if (!jobId) continue;
        let claimed: PrintJob | null = null;
        try {
          claimed = await withTimeout(claimPrintJob(jobId, `${getDeviceLabel()} (${getDeviceId().slice(-4)})`), 10000);
        } catch (err) {
          console.warn('[print-host] falha ao assumir cupom', err);
        }
        if (!claimed) continue; // outro caixa assumiu, ou já foi impresso

        setProcessing(jobId);
        try {
          consumeLastPrinterUsed();
          const result: any = await withTimeout(printJob(claimed), PRINT_TIMEOUT_MS);
          const channel = result?.channel;
          if (channel !== 'qz' && channel !== 'bluetooth') {
            await markPrintJobError(jobId, result?.reason || 'Nada foi enviado para a impressora do caixa.');
            continue;
          }
          await markPrintJobDone(jobId, consumeLastPrinterUsed());
        } catch (err: any) {
          const message = err instanceof Error ? err.message : 'Falha ao imprimir.';
          await markPrintJobError(jobId, message);
          // Persisted error is rediscovered by polling after its retry delay.
        } finally {
          setProcessing(null);
        }
      }
    } finally {
      runningRef.current = false;
    }
  }, [printJob]);

  const enqueue = useCallback((jobId: string) => {
    if (seenRef.current.has(jobId)) return;
    seenRef.current.add(jobId);
    queueRef.current.push(jobId);
    drain();
  }, [drain]);

  // Anuncia este aparelho como Caixa (presença + sinal de vida no banco).
  useEffect(() => {
    const tenantId = user?.tenantId;
    if (!printHostRequested || !tenantId) return;
    return printHostPresence.setHost(tenantId, true, user?.name || null);
  }, [printHostRequested, user?.tenantId, user?.name]);

  useEffect(() => {
    const tenantId = user?.tenantId;
    if (!printHostEnabled || !tenantId) return;

    let active = true;
    seenRef.current = new Set();

    // Cupons que chegaram enquanto o app estava fechado
    (async () => {
      try {
        const pending = await fetchOpenPrintJobs();
        if (!active) return;
        pending.forEach(j => enqueue(j.id));
      } catch (err) {
        console.warn('[print-host] falha ao carregar fila pendente', err);
      }
      purgeOldPrintJobs();
    })();
    const purgeTimer = window.setInterval(() => { purgeOldPrintJobs(); }, 60 * 1000);
    // Não depende só do aviso em tempo real: confere a fila a cada 10s.
    const pollTimer = window.setInterval(async () => {
      try {
        const open = await fetchOpenPrintJobs();
        if (!active) return;
        open.forEach(j => { if (!queueRef.current.includes(j.id)) { seenRef.current.delete(j.id); enqueue(j.id); } });
        drain();
      } catch {}
    }, 10 * 1000);

    const channelName = `print-jobs-host:${tenantId}:${getDeviceId()}`;
    const existing = supabase.getChannels().find(c => c.topic === `realtime:${channelName}`);
    if (existing) {
      supabase.removeChannel(existing);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'print_jobs', filter: `tenant_id=eq.${tenantId}` },
        (payload: any) => {
          const row = payload.new as PrintJob;
          if (row?.status === 'pending') enqueue(row.id);
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'print_jobs', filter: `tenant_id=eq.${tenantId}` },
        (payload: any) => {
          const row = payload.new as PrintJob;
          if (row?.status === 'pending') {
            seenRef.current.delete(row.id); // reenvio manual ("Tentar novamente")
            enqueue(row.id);
          }
        },
      )
      .subscribe();

    return () => {
      window.clearInterval(purgeTimer);
      window.clearInterval(pollTimer);
      active = false;
      queueRef.current = [];
      supabase.removeChannel(channel);
    };
  }, [printHostEnabled, user?.tenantId, enqueue, drain]);

  return { printHostEnabled, processing, hasPrinterAvailable };
}
