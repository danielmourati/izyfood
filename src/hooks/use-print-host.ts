import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { usePrinter } from '@/hooks/use-printer';
import { getDeviceId, getDeviceLabel } from '@/lib/printer';
import {
  claimPrintJob,
  fetchOpenPrintJobs,
  markPrintJobDone,
  markPrintJobError,
  purgeOldPrintJobs,
  MAX_PRINT_ATTEMPTS,
  PRINT_HOST_PRESENCE_PREFIX,
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
  const { printHostEnabled, hasPrinterAvailable, printOrder, printBill, printCashClose } = usePrinter();
  const [processing, setProcessing] = useState<string | null>(null);

  const queueRef = useRef<string[]>([]);
  const runningRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());
  const printerReadyRef = useRef(hasPrinterAvailable);

  useEffect(() => { printerReadyRef.current = hasPrinterAvailable; }, [hasPrinterAvailable]);

  const printJob = useCallback(async (job: PrintJob) => {
    const payload = job.payload || {};
    if (job.kind === 'bill') return printBill(payload, { force: true });
    if (job.kind === 'cash_close') return printCashClose(payload, { force: true });
    return printOrder(payload, { force: true });
  }, [printOrder, printBill, printCashClose]);

  const drain = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const jobId = queueRef.current.shift()!;
        if (!printerReadyRef.current) {
          await markPrintJobError(jobId, 'A impressora do caixa não está conectada.');
          continue;
        }
        let claimed: PrintJob | null = null;
        try {
          claimed = await claimPrintJob(jobId, `${getDeviceLabel()} (${getDeviceId().slice(-4)})`);
        } catch (err) {
          console.warn('[print-host] falha ao assumir cupom', err);
        }
        if (!claimed) continue; // outro caixa assumiu, ou já foi impresso

        setProcessing(jobId);
        try {
          await withTimeout(printJob(claimed), PRINT_TIMEOUT_MS);
          await markPrintJobDone(jobId);
        } catch (err: any) {
          const message = err instanceof Error ? err.message : 'Falha ao imprimir.';
          if ((claimed.attempts || 1) < MAX_PRINT_ATTEMPTS) {
            await markPrintJobError(jobId, `${message} (tentativa ${claimed.attempts}/${MAX_PRINT_ATTEMPTS})`);
            queueRef.current.push(jobId); // retentativa automática
          } else {
            await markPrintJobError(jobId, message);
          }
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

    const channel = supabase
      .channel(`${PRINT_HOST_PRESENCE_PREFIX}${tenantId}`, {
        config: { presence: { key: getDeviceId() } },
      })
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
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ role: 'host', label: getDeviceLabel(), at: new Date().toISOString() });
        }
      });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [printHostEnabled, user?.tenantId, enqueue]);

  return { printHostEnabled, processing, hasPrinterAvailable };
}
