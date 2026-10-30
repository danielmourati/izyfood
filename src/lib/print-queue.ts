/**
 * Fila de impressão compartilhada: os atendentes enviam cupons para a fila e o
 * aparelho do caixa (host) imprime fisicamente.
 */
import { supabase } from '@/integrations/supabase/client';

export type PrintJobKind = 'order' | 'bill' | 'cash_close' | 'test';
export type PrintJobStatus = 'pending' | 'printing' | 'done' | 'error';

export interface PrintJob {
  id: string;
  tenant_id: string;
  created_by: string | null;
  device_label: string | null;
  kind: PrintJobKind;
  payload: any;
  paper_width: number | null;
  copies: number;
  status: PrintJobStatus;
  attempts: number;
  error: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  printed_at: string | null;
  dispatched_at?: string | null;
  printed_on?: string | null;
  created_at: string;
  updated_at?: string;
}

export const PRINT_HOST_PRESENCE_PREFIX = 'print-host:';
export const MAX_PRINT_ATTEMPTS = 3;
export const PRINT_TIMEOUT_MS = 20000;

/** Failed jobs retry with a capped delay; successful/in-flight jobs never retry. */
export function canAutoPrintJob(job: Pick<PrintJob, 'status' | 'claimed_at' | 'attempts' | 'updated_at'> & { printed_at?: string | null; dispatched_at?: string | null; id?: string }, now = Date.now()): boolean {
  if (job.printed_at || job.dispatched_at || (job.id && wasJobSent(job.id))) return false;
  if (job.status !== 'error') return job.status === 'pending';
  const last = Date.parse(job.updated_at || job.claimed_at || '');
  const delay = Math.min(60_000, 10_000 * 2 ** Math.min(Math.max(job.attempts - 1, 0), 3));
  return !Number.isFinite(last) || now - last >= delay;
}

export const printJobKindLabels: Record<PrintJobKind, string> = {
  order: 'Comanda (cozinha)',
  bill: 'Conta do cliente',
  cash_close: 'Fechamento de caixa',
  test: 'Teste de impressão',
};

export const printJobStatusLabels: Record<PrintJobStatus, string> = {
  pending: 'Na fila',
  printing: 'Imprimindo',
  done: 'Impresso',
  error: 'Falhou',
};

const table = () => supabase.from('print_jobs' as any);

export async function insertPrintJob(params: {
  tenantId: string;
  createdBy?: string | null;
  deviceLabel?: string | null;
  kind: PrintJobKind;
  payload: any;
  copies?: number;
}): Promise<string> {
  const { data, error } = await table()
    .insert({
      tenant_id: params.tenantId,
      created_by: params.createdBy ?? null,
      device_label: params.deviceLabel ?? null,
      kind: params.kind,
      payload: params.payload ?? {},
      copies: params.copies ?? 1,
      status: 'pending',
    } as any)
    .select('id')
    .single();

  if (error) throw error;
  return (data as any).id as string;
}

export async function fetchPrintJobs(limit = 20): Promise<PrintJob[]> {
  const { data, error } = await table()
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as unknown as PrintJob[];
}

export async function fetchOpenPrintJobs(): Promise<PrintJob[]> {
  const { data, error } = await table()
    .select('*')
    .in('status', ['pending', 'printing', 'error'])
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) throw error;
  const rows = (data || []) as unknown as PrintJob[];
  return rows.filter(j => canAutoPrintJob(j));
}

/** Trava atômica: só um host consegue assumir o cupom. */
export async function claimPrintJob(jobId: string, claimedBy: string): Promise<PrintJob | null> {
  const { data, error } = await supabase.rpc('claim_print_job_for_host', {
    _job_id: jobId,
    _claimed_by: claimedBy,
    _device_id: (await import('@/lib/printer')).getDeviceId(),
  });
  if (error) throw error;
  const rows = (data || []) as unknown as PrintJob[];
  return rows.length > 0 ? rows[0] : null;
}

const SENT_KEY = 'degust:print-jobs-sent';
export const PRINT_QUEUE_CHANGED_EVENT = 'degust:print-queue-changed';

/** Irreversible, server-side transport boundary, checked again on host takeover. */
export async function beginPrintJobDispatch(jobId: string): Promise<void> {
  const { data, error } = await (supabase as any).rpc('begin_print_job_dispatch', {
    _job_id: jobId, _device_id: (await import('@/lib/printer')).getDeviceId(),
  });
  if (error) throw error;
  if (data !== true) throw new Error('Envio bloqueado: cupom já enviado ou Caixa não é mais o responsável.');
  rememberJobSent(jobId);
}

export function getQueuedOrderIntent(job: Pick<PrintJob, 'attempts' | 'payload'>): 'new' | 'reprint' {
  return job.attempts > 1 || job.payload?.__printIntent === 'reprint' ? 'reprint' : 'new';
}
const SENT_TTL_MS = 24 * 60 * 60 * 1000;

function readSent(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(SENT_KEY) || '{}') as Record<string, number>;
    const now = Date.now();
    return Object.fromEntries(Object.entries(raw).filter(([, t]) => now - t < SENT_TTL_MS));
  } catch { return {}; }
}

/** Lembra no aparelho que este cupom já foi enviado à impressora: nunca reenvia sozinho. */
export function rememberJobSent(jobId: string): void {
  try { const m = readSent(); m[jobId] = Date.now(); localStorage.setItem(SENT_KEY, JSON.stringify(m)); } catch {}
  window.dispatchEvent(new Event(PRINT_QUEUE_CHANGED_EVENT));
}

export function forgetJobSent(jobId: string): void {
  try { const m = readSent(); delete m[jobId]; localStorage.setItem(SENT_KEY, JSON.stringify(m)); } catch {}
}

export function wasJobSent(jobId: string): boolean {
  try { return !!readSent()[jobId]; } catch { return false; }
}

const DONE_PENDING_KEY = 'degust:print-jobs-done-pending';

function readDonePending(): Record<string, string | null> {
  try { return JSON.parse(localStorage.getItem(DONE_PENDING_KEY) || '{}'); } catch { return {}; }
}
function writeDonePending(m: Record<string, string | null>) {
  try { localStorage.setItem(DONE_PENDING_KEY, JSON.stringify(m)); } catch {}
}

/** Marca como impresso e tira o cupom da fila; se falhar, guarda para reenviar a marca depois (nunca reimprime). */
export async function markPrintJobDone(jobId: string, printedOn?: string | null, delays = [2000, 5000, 10000]): Promise<boolean> {
  const pending = readDonePending(); pending[jobId] = printedOn ?? null; writeDonePending(pending);
  rememberJobSent(jobId);
  for (let i = 0; i <= delays.length; i++) {
    try {
      const { error } = await table().update({ status: 'done', printed_at: new Date().toISOString(), error: null, printed_on: printedOn ?? null } as any).eq('id', jobId);
      if (!error) {
        const m = readDonePending(); delete m[jobId]; writeDonePending(m);
        try { await table().delete().eq('id', jobId).eq('status', 'done'); } catch { /* minute cleanup will retry deletion */ }
        return true;
      }
    } catch { /* Keep the durable acknowledgement; never turn this into printer failure. */ }
    if (i < delays.length) await new Promise(r => setTimeout(r, delays[i]));
  }
  const m = readDonePending(); m[jobId] = printedOn ?? null; writeDonePending(m);
  return false;
}

/** Reenvia marcas "Impresso" que não chegaram ao banco. */
export async function flushPendingDoneMarks(): Promise<void> {
  const m = readDonePending();
  for (const [id, on] of Object.entries(m)) await markPrintJobDone(id, on, []);
}

export async function markPrintJobError(jobId: string, message: string): Promise<void> {
  await table().update({ status: 'error', error: message.slice(0, 400) } as any).eq('id', jobId).eq('status', 'printing').is('dispatched_at', null).is('printed_at', null);
}

/** Volta cupons "Na fila"/falhos para a fila; o Caixa imprime uma vez só. */
export async function forcePrintJobs(ids?: string[]): Promise<number> {
  const { data, error } = await (supabase as any).rpc('force_print_jobs', { _ids: ids && ids.length ? ids : null });
  if (error) throw error;
  return Number(data || 0);
}

/** Cupom "Imprimindo" há mais de 60s é considerado travado. */
export function isStalePrinting(job: Pick<PrintJob, 'status' | 'claimed_at'>, now = Date.now()): boolean {
  return job.status === 'printing' && !!job.claimed_at && now - new Date(job.claimed_at).getTime() > 60_000;
}

/** Cupom que pode ser forçado: na fila ou falho. "Imprimindo" já foi entregue a um Caixa e nunca é reenviado. */
export function canForcePrintJob(job: Pick<PrintJob, 'status' | 'claimed_at'> & { printed_at?: string | null; dispatched_at?: string | null }, _now = Date.now()): boolean {
  if (job.printed_at || job.dispatched_at) return false;
  return job.status === 'pending' || job.status === 'error';
}

/** Cupom que ainda pode ser cancelado (não impresso): na fila, falho ou travado. */
export function canCancelPrintJob(job: Pick<PrintJob, 'status' | 'claimed_at'> & { printed_at?: string | null }, now = Date.now()): boolean {
  return canForcePrintJob(job, now) || (!job.printed_at && isStalePrinting(job, now));
}

/** Cancela cupons não impressos (todos, se `ids` vazio); o Caixa não imprime mais. Retorna quantos saíram. */
export async function cancelPrintJobs(ids?: string[]): Promise<number> {
  const { data, error } = await (supabase as any).rpc('cancel_print_jobs', { _ids: ids && ids.length ? ids : null });
  if (error) throw error;
  return Number(data || 0);
}

export async function clearDonePrintJobs(): Promise<void> {
  await table().delete().eq('status', 'done');
}

export async function purgeOldPrintJobs(): Promise<void> {
  try {
    // Cupons já impressos saem da fila na limpeza (executada a cada 1 minuto).
    await (supabase as any).rpc('finalize_stale_printing_jobs');
    await table().delete().eq('status', 'done');
    await (supabase as any).rpc('purge_print_jobs');
    // Cupons que falharam de pedidos já finalizados/cancelados não servem mais
    await (supabase as any).rpc('purge_stale_failed_print_jobs');
  } catch (err) {
    console.warn('[print-queue] limpeza automática falhou', err);
  }
}
