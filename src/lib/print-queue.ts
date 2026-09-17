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
  created_at: string;
}

export const PRINT_HOST_PRESENCE_PREFIX = 'print-host:';
export const MAX_PRINT_ATTEMPTS = 3;
export const PRINT_TIMEOUT_MS = 20000;

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
    .in('status', ['pending'])
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) throw error;
  return (data || []) as unknown as PrintJob[];
}

/** Trava atômica: só um host consegue assumir o cupom. */
export async function claimPrintJob(jobId: string, claimedBy: string): Promise<PrintJob | null> {
  const { data, error } = await (supabase as any).rpc('claim_print_job', {
    _job_id: jobId,
    _claimed_by: claimedBy,
  });
  if (error) throw error;
  const rows = (data || []) as unknown as PrintJob[];
  return rows.length > 0 ? rows[0] : null;
}

export async function markPrintJobDone(jobId: string): Promise<void> {
  await table().update({ status: 'done', printed_at: new Date().toISOString(), error: null } as any).eq('id', jobId);
}

export async function markPrintJobError(jobId: string, message: string): Promise<void> {
  await table().update({ status: 'error', error: message.slice(0, 400) } as any).eq('id', jobId);
}

export async function retryPrintJob(jobId: string): Promise<void> {
  await table()
    .update({ status: 'pending', error: null, attempts: 0, claimed_by: null, claimed_at: null } as any)
    .eq('id', jobId);
}

export async function clearDonePrintJobs(): Promise<void> {
  await table().delete().eq('status', 'done');
}

export async function purgeOldPrintJobs(): Promise<void> {
  try {
    await (supabase as any).rpc('purge_print_jobs');
  } catch (err) {
    console.warn('[print-queue] limpeza automática falhou', err);
  }
}
